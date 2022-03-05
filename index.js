const {Telegraf} = require('telegraf');
const {Client} = require("@notionhq/client");
const bot = new Telegraf(process.env.BOT_TOKEN);
const express = require('express')

const app = express()
app.use(express.json())

const notion = new Client({auth: process.env.NOTION_TOKEN})
const databaseId = process.env.NOTION_DATABASE;

app.post('/', (req) => {
    console.log(req.body)
})

bot.command('start', ctx => ctx.reply('Привіт, як ти? Розкажи мені'))

// copy every message and send to the user
bot.on('message', (ctx) => {
    notion.pages.create({
        parent: {
            database_id: databaseId
        }, properties: {
            telegramId: {
                title: [{
                    text: {
                        content: String(ctx.chat.id)
                    }
                }]
            }, Message: {
                rich_text: [{
                    text: {
                        content: ctx.message.text
                    }
                }]
            }
        }
    }).then(() => ctx.reply("Дякую, записав"))
        .catch(() => ctx.reply("Ой, щось не вийшло, спробуй пізіше"))
})

// bot.launch();
// Start webhook via launch method (preferred)
bot.launch({
    webhook: {
        domain: 'my-hearts-diary.herokuapp.com', port: process.env.PORT
    }
})

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
