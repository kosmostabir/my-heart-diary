const {Telegraf, Markup} = require('telegraf');
const {Client} = require("@notionhq/client");

const bot = new Telegraf(process.env.BOT_TOKEN);
const notion = new Client({auth: process.env.NOTION_TOKEN})
const devId = 230373802;

const USERS_TABLE_ID = 'e10d69e91bc54d208028f7c1a321f3f7';
const MEMORIES_PARENT_PAGE_ID = 'a16a72e22c0a480b8cd54cd4d54d0386';

bot.command('start', ctx => {
    ctx.reply('Привіт, як тебе звати?', Markup.keyboard([ctx.chat.first_name, ctx.chat.username]));
})
bot.on('message', (ctx) => {
    notion.databases.query({
        database_id: USERS_TABLE_ID, filter: {
            property: 'telegramId', title: {
                equals: String(ctx.chat.id)
            }
        }
    }).then(({results}) => {
        if (!results.length) {
            return notion.pages.create({
                parent: {
                    page_id: MEMORIES_PARENT_PAGE_ID,
                }, properties: {
                    title: [{text: {content: ctx.message.text}}]
                }
            }).then(({id: personalPageId}) => notion.pages.create({
                parent: {
                    database_id: USERS_TABLE_ID
                }, properties: {
                    telegramId: {
                        title: [{text: {content: String(ctx.chat.id)}}]
                    }, name: {
                        rich_text: [{text: {content: ctx.message.text}}]
                    }, personalPageId: {
                        rich_text: [{text: {content: personalPageId}}]
                    }
                }
            })).then(() => ctx.reply(`Радий знайомству, ${ctx.message.text}`, {
                reply_markup: {
                    remove_keyboard: true
                }
            }))
        } else {
            if (ctx.message.text) {
                return notion.blocks.children.append({
                    block_id: results[0].properties.personalPageId.rich_text[0].text.content, children: [{
                        paragraph: {rich_text: [{text: {content: ctx.message.text}}]}
                    }]
                })
            } else if (ctx.message.voice) {
                return ctx.telegram.getFileLink(ctx.message.voice.file_id).then(url => notion.blocks.children.append({
                    block_id: results[0].properties.personalPageId.rich_text[0].text.content, children: [{
                        audio: {
                            external: {url},
                            caption: ctx.message.caption && [{text: {content: ctx.message.caption}}],
                        }
                    }]
                }))
            } else if (ctx.message.photo) {
                return ctx.telegram.getFileLink(ctx.message.photo[ctx.message.photo.length - 1].file_id).then(url => notion.blocks.children.append({
                    block_id: results[0].properties.personalPageId.rich_text[0].text.content, children: [{
                        image: {
                            external: {url},
                            caption: ctx.message.caption && [{text: {content: ctx.message.caption}}],
                        },
                    }]
                }))
            } else if (ctx.message.video) {
                return ctx.telegram.getFileLink(ctx.message.video.file_id).then(url => notion.blocks.children.append({
                    block_id: results[0].properties.personalPageId.rich_text[0].text.content, children: [{
                        video: {
                            external: {url},
                            caption: ctx.message.caption && [{text: {content: ctx.message.caption}}],
                        }
                    }]
                }))
            } else if (ctx.message.document) {
                return ctx.telegram.getFileLink(ctx.message.document.file_id).then(url => notion.blocks.children.append({
                    block_id: results[0].properties.personalPageId.rich_text[0].text.content, children: [{
                        file: {
                            external: {url},
                            caption: ctx.message.caption && [{text: {content: ctx.message.caption}}],
                        },
                    }]
                }))
            } else {
                ctx.reply('Вибач, я поки не розумію такі повідомлення')
                bot.sendMessage(devId, "Повідомлення не підтримується:")
                bot.sendMessage(devId, JSON.stringify(ctx.message))
            }
        }
    });
})

bot.launch(process.env.NODE_ENV === 'production' ? {
    webhook: {
        domain: process.env.HEROKU_URL, port: Number(process.env.PORT)
    }
} : {})

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
