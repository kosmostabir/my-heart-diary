import {createHash, createHmac} from "crypto";
import {UserService} from "./user.service";
import {Bot} from "./bot";
import {Pool} from "pg";
import {MemoryService} from "./memory.service";
import {FeedbackService} from "./feedback.service";
import {I18nService} from "./I18n.service";

// const {Client: Notion} = require("@notionhq/client");

const DEV_ID = 230373802;
const CURATORS: number[] = JSON.parse(`[${process.env.CURATORS || DEV_ID}]`);

const path = require("path");
const express = require("express");

new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {rejectUnauthorized: false}
}).connect((err, client, done) => {
    err && console.trace(err);
    const userService: UserService = new UserService(client);
    const memoriesService = new MemoryService(client);
    const feedbackService = new FeedbackService(client);
    const i18nService = new I18nService(client);
    const bot = new Bot(userService, memoriesService, feedbackService, i18nService);

    // const notion = new Notion({auth: process.env.NOTION_TOKEN})

    const secretKey = createHash('sha256').update(bot.token).digest();

    const app = express()
    app.use(express.json())

    // Enable graceful stop
    process.once('SIGINT', () => {
        done();
        bot.stop('SIGINT')
    })
    process.once('SIGTERM', () => {
        done();
        bot.stop('SIGTERM')
    })

    // app.get("/api/move", (req, res) => {
    //         function getPageOfUsers(cursor?: string) {
    //             return notion.databases.query({
    //                 database_id: 'ada738a563ac4376956f47ef5ccb2294',
    //                 start_cursor: cursor,
    //             }).then((page) => {
    //                 return Promise.all(page.results.map(user => notion.blocks.children.list({
    //                         block_id: user.properties.personalPageId.rich_text[0].text.content
    //                     }).then(page => {
    //                         return userService.createUser({
    //                             userId: user.properties.telegramId.title[0].plain_text,
    //                             name: user.properties.name.rich_text[0].plain_text.slice(0, 50),
    //                             consent: user.properties.consent.checkbox
    //                         }).catch((e) => {
    //                             console.trace(e);
    //                             console.log(user.properties.telegramId.title[0].plain_text,
    //                                 user.properties.name.rich_text[0].plain_text,
    //                                 user.properties.consent.checkbox
    //                             )
    //                         })
    //                         //.then(() =>
    //                         //             notion.blocks.children.list({
    //                         //                 block_id: user.properties.personalPageId.rich_text[0].plain_text
    //                         //             }).then(page => {
    //                         //                 page.results.forEach(memory => {
    //                         //                     const m: Memory = {
    //                         //                         text: memory.paragraph.rich_text[1].plain_text,
    //                         //                         type: MemoryType.TEXT,
    //                         //                     }
    //                         //                 })
    //                         //             }).catch(console.log)
    //                         //         })
    //                         //     ));
    //                     }))
    //                 ).then(() => page.has_more ? getPageOfUsers(page.next_cursor) : Promise.resolve())
    //             })
    //         }
    //
    //         getPageOfUsers().then(() => console.log("DONE"))
    //     }
    // )

    function authenticate(authDataCookie) {
        try {
            const authData = JSON.parse(decodeURIComponent(authDataCookie.match(new RegExp('authToken=([^;]+)'))[1]));
            const hash = authData.hash;
            delete authData.hash;
            const dataCheckString = Object.keys(authData).sort().map(key => `${key}=${authData[key]}`).join("\n");
            const signature = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
            return signature === hash && authData.id;
        } catch (e) {
            return null
        }
    }

    app.post('/' + bot.token, (req, res) => {
        return bot.handleUpdate(req.body, res)
    });

    app.get("/api/memories", (req, res) => {
        try {
            const telegramId = authenticate(req.header('Cookie'));
            if (telegramId) {
                (req.query.user && CURATORS.includes(telegramId)
                        ? userService.getUser(Number(req.query.user)).then(user => {
                            if (!user.consent) {
                                throw Error(`${user.name} ${user.userId} did not provide consent`)
                            }
                            return user.userId
                        })
                        : Promise.resolve(telegramId)
                ).then(userId => memoriesService.getMemories(userId)
                    .then(memories => {
                        if (!memories.length) {
                            return userService.getUser(telegramId).then(user => {
                                if (user) {
                                    res.sendStatus(204);
                                } else {
                                    res.sendStatus(404);
                                }
                            })
                        } else {
                            return bot.enrichWithUrls(memories).then(memories => res.status(200).json(memories))
                        }
                    })
                ).catch(e => console.trace(e))
            } else {
                res.sendStatus(403);
            }
        } catch (e) {
            res.sendStatus(403);
        }
    })

    app.get("/api/consented-users", (req, res) => {
        try {
            const telegramId = authenticate(req.header('Cookie'));
            if (telegramId && CURATORS.includes(telegramId)) {
                userService.getConsentedUsersInfo()
                    .then(users => res.status(200).json(users))
                    .catch(e => console.trace(e))
            } else {
                res.sendStatus(403);
            }
        } catch (e) {
            res.sendStatus(403);
        }
    })

// add middlewares
    app.use(express.static(path.join(__dirname, "..", "build")));
    app.use(express.static("public"));

    app.use((req, res, next) => {
        const telegramId = authenticate(req.header('Cookie'));
        res.cookie("role", [...CURATORS, DEV_ID].includes(telegramId) && 'true')
            .sendFile(path.join(__dirname, "..", "build", "index.html"));
    });

    const port = process.env.PORT || 80;
    app.listen(port, () => {
        console.log(`You Can Tell Me is listening on port ${port}`)
    });
    return bot.launch();
});
