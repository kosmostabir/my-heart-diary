const {Telegraf, Markup} = require('telegraf');
const {Client} = require("@notionhq/client");

const DEV = 230373802;
const CURATORS = JSON.parse(`[${process.env.CURATORS || DEV}]`);
const TEST_BOT = '5120680530:AAGb1v6STa7StPE-m7v26gaCvc9oo3TjXqs'
const bot = new Telegraf(process.env.BOT_TOKEN || TEST_BOT);
const notion = new Client({auth: process.env.NOTION_TOKEN})
const devId = 230373802;

const USERS_TABLE_ID = 'e10d69e91bc54d208028f7c1a321f3f7';
const MEMORIES_PARENT_PAGE_ID = 'a16a72e22c0a480b8cd54cd4d54d0386';

const CONSENT_ACTION = 'consent';
const CONSENT_COMMAND = 'consent';
const RENAME_COMMAND = 'rename';
const REFUSE_ACTION = 'refuse';
const PROMPT_NEW_NAME_MSG = "Нове ім'я:"
const WANT_TO_TELL_ACTION = 'Хочу щось розказати';
const DONE_TELLING_ACTION = 'Дякую, що вислухав';
const WANT_TO_TELL_MARKUP = {
    reply_markup: {
        keyboard: [[WANT_TO_TELL_ACTION]],
        one_time_keyboard: true
    }
}
const DONE_TELLING_MARKUP = {
    reply_markup: {
        keyboard: [[DONE_TELLING_ACTION]],
        one_time_keyboard: true
    }
}

const timers = new Map();

/**
 *
 * @param ctx
 * @returns {Promise<{parent: {type: "page_id", page_id: IdRequest}, id: string, properties: {telegramId: {type: "title", title: Array<RichTextItemResponse>, id: string}, name: {type: "rich_text", rich_text: Array<RichTextItemResponse>, id: string}, personalPageId: {type: "rich_text", rich_text: Array<RichTextItemResponse>, id: string}, consent: {type: "checkbox", checkbox: boolean, id: string}, tellingTheStory: {checkbox: boolean}}}>}
 */
const getUser = ctx => notion.databases.query({
    database_id: USERS_TABLE_ID, filter: {
        property: 'telegramId', title: {
            equals: String(ctx.chat.id)
        }
    }
}).then(({results}) => results[0]);

/**
 *
 * @param user {parent: {type: "page_id", page_id: IdRequest}, id: string, properties: {telegramId: {type: "title", title: Array<RichTextItemResponse>, id: string}, name: {type: "rich_text", rich_text: Array<RichTextItemResponse>, id: string}, personalPageId: {type: "rich_text", rich_text: Array<RichTextItemResponse>, id: string}, consent: {type: "checkbox", checkbox: boolean, id: string}}}
 * @param properties {telegramId: {title: Array<RichTextItemResponse>}, name: { rich_text: Array<RichTextItemResponse>}, personalPageId: {rich_text: Array<RichTextItemResponse>}, consent: {checkbox: boolean}, tellingTheStory: {checkbox: boolean}}
 */
const updateUser = (user, properties) => notion.pages.update({
    page_id: user.id, properties
})

const askUserName = ctx => {
    const options = [ctx.chat.username];
    if (ctx.chat.username !== ctx.chat.first_name) {
        options.push(ctx.chat.first_name)
    }
    if (ctx.chat.last_name) {
        options.push(`${ctx.chat.first_name} ${ctx.chat.last_name}`)
    }
    ctx.reply('Як тебе звати?', Markup.keyboard(options.map(name => Markup.button.text(name), {columns: 1})));
}

const askForConsent = ctx => ctx.reply('Дозволиш використовувати твої спогади у арт-проєктах?', Markup.inlineKeyboard([Markup.button.callback("Я даю згоду на обробку персональних даних згідно Закону України 2297-VI «Про захист персональних даних» від 13.02.2022 ст.6", CONSENT_ACTION), Markup.button.callback("Ні, вони лише для мене", REFUSE_ACTION),], {columns: 1}))

function getDateTimeString() {
    return new Date().toLocaleString('uk-UA') + ':\n';
}

function sendTypingStatus(ctx) {
    return ctx.replyWithChatAction('typing');
}

bot.command('start', ctx => {
    sendTypingStatus(ctx);
    notion.databases.query({
        database_id: USERS_TABLE_ID, filter: {
            property: 'telegramId', title: {
                equals: String(ctx.chat.id)
            }
        }
    }).then(({results}) => {
        if (!results.length) {
            bot.telegram.sendMessage(ctx.chat.id, 'Привіт, цей телеграм-канал створено задля збереження наших спільних спогадів, думок та переживань кожної. Кожна з нас є лише краплею, та всі разом ми - океан.')
                .then(() => askUserName(ctx));
        } else {
            ctx.reply('З поверненням, ' + results[0].properties.name.rich_text[0].text.content, WANT_TO_TELL_MARKUP);
            getUser(ctx).then(user => {
                if (!user.properties.consent.checkbox) {
                    askForConsent(ctx)
                }
            })
        }
    })
})

bot.action(CONSENT_ACTION, ctx => getUser(ctx).then(user => {
    if (!user.properties.consent.checkbox) {
        sendTypingStatus(ctx);
        return updateUser(user, {
            consent: {checkbox: true}
        }).then(() => ctx.reply("Дякую за твій внесок!", WANT_TO_TELL_MARKUP))
    } else {
        ctx.reply("Дякую, у мене вже є твоя згода", WANT_TO_TELL_MARKUP)
    }
}));
bot.command(CONSENT_COMMAND, askForConsent);
bot.command(RENAME_COMMAND, ctx => ctx.reply(PROMPT_NEW_NAME_MSG, {
    reply_markup: {force_reply: true}
}));

bot.on('message', (ctx) => {
    getUser(ctx).then(user => {
        if (!user) {
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
            })).then(() => {
                ctx.reply(`Дякую ${ctx.message.text}, що знайшла в собі сили розповісти свою історію!`, Markup.removeKeyboard());
                askForConsent(ctx);
            });
        } else {
            clearTimeout(timers.get(ctx.chat.id));
            timers.set(ctx.chat.id, setTimeout(() => ctx.reply("Дякую, що поділилася ❤️", DONE_TELLING_MARKUP), 60000 * 5))

            if (ctx.message.reply_to_message?.text === PROMPT_NEW_NAME_MSG && ctx.message.text) {
                sendTypingStatus(ctx);
                return getUser(ctx).then(user => notion.pages.update({
                    page_id: user.properties.personalPageId.rich_text[0].text.content,
                    properties: {
                        title: {
                            title: [{text: {content: ctx.message.text}}]
                        }
                    }
                }).then(() => notion.pages.update({
                    page_id: user.id,
                    properties: {
                        name: {
                            rich_text: [{text: {content: ctx.message.text}}]
                        }
                    }
                })).then(() => ctx.reply("Ок, тепер зватиму тебе " + ctx.message.text, WANT_TO_TELL_MARKUP)))
            }
            if (ctx.message.text === WANT_TO_TELL_ACTION) {
                sendTypingStatus(ctx);
                getUser(ctx)
                    .then(user => updateUser(user, {tellingTheStory: {checkbox: true}}))
                    .then(() => ctx.reply("Розкажи мені! Пиши, говори, надсилай фото, записуй відео - я тебе уважно слухаю", Markup.removeKeyboard()))
            } else if (ctx.message.text === DONE_TELLING_ACTION) {
                sendTypingStatus(ctx)
                getUser(ctx).then(user => updateUser(user, {tellingTheStory: {checkbox: false}}))
                    .then(() => ctx.reply("Я завжди тут", WANT_TO_TELL_MARKUP))
            } else {
                if (ctx.message.text) {
                    return notion.blocks.children.append({
                        block_id: user.properties.personalPageId.rich_text[0].text.content, children: [{
                            paragraph: {
                                rich_text: [
                                    {
                                        text: {content: getDateTimeString()},
                                        annotations: {italic: true}
                                    },
                                    {text: {content: ctx.message.text}}]
                            }
                        }]
                    })
                } else if (ctx.message.voice) {
                    return ctx.telegram.getFileLink(ctx.message.voice.file_id).then(url => notion.blocks.children.append({
                        block_id: user.properties.personalPageId.rich_text[0].text.content, children: [{
                            audio: {
                                external: {url},
                                caption: ctx.message.caption && [{text: {content: ctx.message.caption}}],
                            }
                        }]
                    }))
                } else if (ctx.message.photo) {
                    return ctx.telegram.getFileLink(ctx.message.photo[ctx.message.photo.length - 1].file_id).then(url => notion.blocks.children.append({
                        block_id: user.properties.personalPageId.rich_text[0].text.content, children: [{
                            image: {
                                external: {url},
                                caption: ctx.message.caption && [{text: {content: ctx.message.caption}}],
                            },
                        }]
                    }))
                } else if (ctx.message.video) {
                    return ctx.telegram.getFileLink(ctx.message.video.file_id).then(url => notion.blocks.children.append({
                        block_id: user.properties.personalPageId.rich_text[0].text.content, children: [{
                            video: {
                                external: {url},
                                caption: ctx.message.caption && [{text: {content: ctx.message.caption}}],
                            }
                        }]
                    }))
                } else if (ctx.message.document) {
                    return ctx.telegram.getFileLink(ctx.message.document.file_id).then(url => notion.blocks.children.append({
                        block_id: user.properties.personalPageId.rich_text[0].text.content, children: [{
                            file: {
                                external: {url},
                                caption: ctx.message.caption && [{text: {content: ctx.message.caption}}],
                            },
                        }]
                    }))
                } else {
                    ctx.reply('Вибач, я поки не розумію такі повідомлення')
                    bot.telegram.sendMessage(devId, "Повідомлення не підтримується:")
                        .then(() => bot.telegram.sendMessage(devId, JSON.stringify(ctx.message)))
                }
            }
        }
    });
})

bot.action(REFUSE_ACTION, ctx => getUser(ctx).then(user => {
    if (user.properties.consent.checkbox) {
        sendTypingStatus(ctx);
        return updateUser(user, {
            consent: {checkbox: false}
        }).then(() => {
            ctx.reply('Ок, твої спогади залишаться у секреті.\nЯкщо захочеш, можеш дати згоду пізніше командою /consent', WANT_TO_TELL_MARKUP);
            CURATORS.forEach(curator => bot.telegram.sendMessage(curator, `${user.properties.name.rich_text[0].text.content} ${user.properties.telegramId.title[0].text.content} відкликала згоду на використання матеріалів`))
        })
    } else {
        ctx.reply("Не хвилюйся, твої спогади у секреті", WANT_TO_TELL_MARKUP)
    }
}))

bot.launch(process.env.NODE_ENV === 'production' ? {
    webhook: {
        domain: process.env.HEROKU_URL, port: Number(process.env.PORT)
    }
} : {})

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

function messageAllUsers(message) {
    notion.databases.query({
        database_id: USERS_TABLE_ID
    }).then(({results}) => results.forEach(user => bot.telegram.sendMessage(user.properties.telegramId.title[0].text.content, message)));
}

// messageAllUsers()
