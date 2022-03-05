const {Telegraf} = require('telegraf');
const {Client} = require("@notionhq/client");
const express = require('express')

const app = express()
app.use(express.json())
const bot = new Telegraf(process.env.BOT_TOKEN);

const notion = new Client({auth: process.env.NOTION_TOKEN})
const databaseId = process.env.NOTION_DATABASE;

bot.command('start', ctx => ctx.reply('Привіт, як ти? Розкажи мені'))

app.post('/' + process.env.BOT_TOKEN, (req, resp) => {
    console.log(req.body)
    bot.processUpdate(req.body)
    resp.sendStatus(200);
})

app.listen(process.env.PORT || 3000, () => console.log("express started on port " + process.env.PORT))

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

bot.launch(process.env.NODE_ENV === 'production' ? {
    webhook: {
        domain: process.env.HEROKU_URL,
        port: process.env.PORT,
        hookPath: process.env.BOT_TOKEN,
    }
} : {})

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
