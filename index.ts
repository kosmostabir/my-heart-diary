// import {Pool} from "pg";
// import {UserService} from "./user.service";
// import {MemoryService} from "./memory.service";
// import {Bot} from "./bot";
// import * as express from "express";
//
// const {Client} = require("@notionhq/client");
//
// const DEV_ID = 230373802;
// const CURATORS = JSON.parse(`[${process.env.CURATORS || DEV_ID}]`);
// const notion = new Client({auth: process.env.NOTION_TOKEN})
// const ANN_SHEVCHENKO_ID = 425812329;
//
// const USERS_TABLE_ID = 'ada738a563ac4376956f47ef5ccb2294';
// const MEMORIES_PARENT_PAGE_ID = '68743b477c3241dd970ed99de6b0b737';
// const FEEDBACK_PAGE_ID = '4b2ca9542d8d4bddb236b920f78d1d52';
//
// new Pool({
//     connectionString: process.env.DATABASE_URL,
//     ssl: {rejectUnauthorized: false}
// }).connect((err, client, done) => {
//     const userService = new UserService(client);
//     const memoriesService = new MemoryService(client);
//     const bot = new Bot(userService, memoriesService);
//
//     const app = express()
//     app.use(express.json())
//
//     // Enable graceful stop
//     process.once('SIGINT', () => {
//         done();
//         bot.stop('SIGINT')
//     })
//     process.once('SIGTERM', () => {
//         done();
//         bot.stop('SIGTERM')
//     })
//
//     app.get("/api/memories", (req, res) => {
//         console.log(req.cookies)
//     })
//
//     app.listen(process.env.PORT || 3000, () => {
//         console.log(`You Can Tell Me is listening on port ${process.env.PORT || 3000}`)
//     });
//     return bot.launch();
// });
