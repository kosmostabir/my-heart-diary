const {Telegraf} = require('telegraf');
const {Client} = require("@notionhq/client");
const express = require('express')

const bot = new Telegraf(process.env.BOT_TOKEN);
const notion = new Client({auth: process.env.NOTION_TOKEN})
const databaseId = process.env.NOTION_DATABASE;

bot.command('start', ctx => ctx.reply('Привіт, як ти? Розкажи мені'))
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
        hookPath: `${process.env.HEROKU_URL}:${process.env.PORT}/${process.env.BOT_TOKEN}`,
    }
} : {})

const app = express()
app.use(express.json())

app.post('/' + process.env.BOT_TOKEN, (req, resp) => {
    console.log(req.body)
    bot.processUpdate(req.body)
    resp.sendStatus(200);
})

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))


app.listen(process.env.PORT || 3000, () => {
    console.log(`Example app listening on port ${process.env.PORT || 3000}`)
})
