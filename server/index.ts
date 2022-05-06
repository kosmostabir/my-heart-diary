import {createHash, createHmac} from "crypto";
import {UserService} from "./user.service";
import {Bot} from "./bot";
import {Pool} from "pg";
import {MemoryService} from "./memory.service";
import {FeedbackService} from "./feedback.service";
import {LocalizationService} from "./localization.service";

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
    const localization = new LocalizationService();
    const bot = new Bot(userService, memoriesService, feedbackService, localization);

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

    app.get("/api/0000", async (req, res) => {
        const memories = await memoriesService.getMemories(DEV_ID)
        res.header("Access-Control-Allow-Origin", "https://tellme.kosmostabir.org/").json(memories)
    })

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

    app.use((req, res) => {
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
