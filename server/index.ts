import {createHash, createHmac} from "crypto";
import {UserService} from "./user.service";
import {Bot} from "./bot";
import {Pool} from "pg";
import {MemoryService} from "./memory.service";

const {Client: Notion} = require("@notionhq/client");

const path = require("path");
const express = require("express");

new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {rejectUnauthorized: false}
}).connect((err, client, done) => {
    err && console.trace(err);
    const userService = new UserService(client);
    const memoriesService = new MemoryService(client);
    const bot = new Bot(userService, memoriesService);

    const notion = new Notion({auth: process.env.NOTION_TOKEN})

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
    //     notion.databases.query({
    //         database_id: 'ada738a563ac4376956f47ef5ccb2294',
    //     }).then(({results}) => results.forEach(user => notion.blocks.children.list({
    //         block_id: user.properties.personalPageId.rich_text[0].text.content
    //     }).then(page => {
    //         userService.createUser({
    //             userId: user.properties.telegramId.
    //         })
    //         })
    //     ));
    // })

    app.get("/api/memories",
        (req, res) => {
            try {
                // const hmac = createHmac;
                // const hash = createHash;
                const authData = JSON.parse(decodeURIComponent(req.header('Cookie').match(new RegExp('authToken=([^;]+)'))[1]));
                const hash = authData.hash;
                delete authData.hash;
                const dataCheckString = Object.keys(authData).sort().map(key => `${key}=${authData[key]}`).join("\n");
                const signature = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
                if (signature === hash) {
                    memoriesService.getMemories(authData.id)
                        .then(memories => {
                            if (!memories.length) {
                                return userService.getUser(authData.id).then(user => {
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
        res.sendFile(path.join(__dirname, "..", "build", "index.html"));
    });

    const port = process.env.PORT || 80;
    app.listen(port, () => {
        console.log(`You Can Tell Me is listening on port ${port}`)
    });
    return bot.launch();
});
