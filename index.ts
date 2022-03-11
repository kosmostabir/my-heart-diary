const {Telegraf, Markup} = require('telegraf');
const {Client} = require("@notionhq/client");

const DEV_ID = 230373802;
const CURATORS = JSON.parse(`[${process.env.CURATORS || DEV_ID}]`);
const notion = new Client({auth: process.env.NOTION_TOKEN})
const ANN_SHEVCHENKO_ID = 425812329;

const USERS_TABLE_ID = 'ada738a563ac4376956f47ef5ccb2294';
const MEMORIES_PARENT_PAGE_ID = '68743b477c3241dd970ed99de6b0b737';
const FEEDBACK_PAGE_ID = '4b2ca9542d8d4bddb236b920f78d1d52';

/**
 *
 * @type {(() => Promise)[]}
 */
const queue = [];
let writing;

/**
 *
 * @param func {() => Promise}
 */
function doPerformWriteOperation(func) {
    if (writing) {
        queue.push(func)
    } else {
        function next() {
            return queue.length ? queue.shift()().then(() => writing = next()) : null;
        }

        writing = func().then(() => writing = next());
    }
}

try {

    /**
     *
     * @param ctx
     * @returns {Promise<{parent: {type: "page_id", page_id: IdRequest}, id: string, properties: {telegramId: {type: "title", title: Array<RichTextItemResponse>, id: string}, name: {type: "rich_text", rich_text: Array<RichTextItemResponse>, id: string}, personalPageId: {type: "rich_text", rich_text: Array<RichTextItemResponse>, id: string}, consent: {type: "checkbox", checkbox: boolean, id: string}, email: {email: string}, linkToPage: {url: string}}}>}
     */
    const getUser = ctx => notion.databases.query({
        database_id: USERS_TABLE_ID, filter: {
            property: 'telegramId', title: {
                equals: String(ctx.chat.id)
            }
        }
    }).then(({results}) => {
        if (!results[0]) {
            ctx.reply('Спочатку /start');
            return Promise.reject(`no user ${ctx.chat.id}`)
        }
        return results[0];
    }).catch(console.trace);

    /**
     *
     * @param user {parent: {type: "page_id", page_id: IdRequest}, id: string, properties: {telegramId: {type: "title", title: Array<RichTextItemResponse>, id: string}, name: {type: "rich_text", rich_text: Array<RichTextItemResponse>, id: string}, personalPageId: {type: "rich_text", rich_text: Array<RichTextItemResponse>, id: string}, consent: {type: "checkbox", checkbox: boolean, id: string}}}
     * @param properties {telegramId: {title: Array<RichTextItemResponse>}, name: { rich_text: Array<RichTextItemResponse>}, personalPageId: {rich_text: Array<RichTextItemResponse>}, consent: {checkbox: boolean}, email: {email: boolean}}
     */
    const updateUser = (user, properties) => performWriteOperation(() => notion.pages.update({
        page_id: user.id, properties
    }))

    /**
     *
     * @param action {() => Promise}
     * @returns {Promise<unknown>}
     */
    function performWriteOperation(action) {
        return new Promise(resolve => {
            doPerformWriteOperation(() => action().then(resolve))
        })
    }

    const askUserName = ctx => {
        const options = [ctx.chat.username];
        if (ctx.chat.username !== ctx.chat.first_name) {
            options.push(ctx.chat.first_name)
        }
        if (ctx.chat.last_name) {
            options.push(`${ctx.chat.first_name} ${ctx.chat.last_name}`)
        }
        ctx.reply('Як тебе звати?', Markup.keyboard(options.filter(Boolean).map(name => Markup.button.text(name), {columns: 1})))
            .catch(console.trace);
    }

    const promptEmail = ctx => ctx.reply(PROMPT_EMAIL_MESSAGE, FORCE_REPLY_MARKUP)
        .catch(console.trace);
    const askForConsent = ctx => ctx.reply('Дозволиш використовувати твої спогади у арт-проєктах?', Markup.inlineKeyboard([Markup.button.callback("Я даю згоду на обробку персональних даних\nзгідно Закону України 2297-VI\n«Про захист персональних даних»\nвід 13.02.2022 ст.6", CONSENT_ACTION), Markup.button.callback("Ні, вони лише для мене", REFUSE_ACTION),], {columns: 1}))
        .catch(console.trace)

    function getDateTimeBlock(newLine = false) {
        return {
            text: {content: new Date().toLocaleString('uk-UA') + (newLine ? ':\n' : '')}, annotations: {italic: true}
        };
    }

    function getFileCaption(ctx) {
        return ctx.message.caption ? [getDateTimeBlock(true), {text: {content: ctx.message.caption}}] : [getDateTimeBlock()]
    }

    function sendTypingStatus(ctx) {
        // return ctx.replyWithChatAction('typing');
    }



    function messageToNotionBlocks(ctx) {
        if (ctx.message.text) {
            return Promise.resolve([{
                paragraph: {
                    rich_text: [getDateTimeBlock(true), {text: {content: ctx.message.text}}]
                }
            }]);
        } else if (ctx.message.voice) {
            return ctx.telegram.getFileLink(ctx.message.voice.file_id).then(url => [{
                audio: {
                    external: {url}, caption: getFileCaption(ctx),
                }
            }]);
        } else if (ctx.message.photo) {
            return ctx.telegram.getFileLink(ctx.message.photo[ctx.message.photo.length - 1].file_id).then(url => [{
                image: {
                    external: {url}, caption: getFileCaption(ctx),
                },
            }]);
        } else if (ctx.message.video) {
            return ctx.telegram.getFileLink(ctx.message.video.file_id).then(url => [{
                video: {
                    external: {url}, caption: getFileCaption(ctx),
                }
            }]);
        } else if (ctx.message.document) {
            return ctx.telegram.getFileLink(ctx.message.document.file_id).then(url => [{
                file: {
                    external: {url}, caption: getFileCaption(ctx),
                },
            }])
        } else {
            ctx.reply('Вибач, я поки не розумію такі повідомлення').catch(console.trace)
            bot.telegram.sendMessage(DEV_ID, "Повідомлення не підтримується:")
                .then(() => bot.telegram.sendMessage(DEV_ID, JSON.stringify(ctx.message)))
                .catch(console.trace);
        }
    }

    bot.on('message', (ctx) => {
        sendTypingStatus(ctx);
        getUser(ctx).then(user => {
            if (!user) {
                return performWriteOperation(() => notion.pages.create({
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
                        },
                        linkToPage: {url: `https://www.notion.so/${personalPageId.replaceAll('-', '')}`}
                    }
                }))).then(() => {
                    ctx.reply(`Дякую ${ctx.message.text}, що маєш в собі сили розповісти свою історію!`);
                    askForConsent(ctx);
                    promptEmail(ctx);
                });
            } else {
                if (ctx.message.reply_to_message) {
                    if (ctx.message.reply_to_message.text === PROMPT_NEW_NAME_MSG && ctx.message.text) {
                        return getUser(ctx).then(user => performWriteOperation(() => notion.pages.update({
                            page_id: user.properties.personalPageId.rich_text[0].text.content, properties: {
                                title: {
                                    title: [{text: {content: ctx.message.text}}]
                                }
                            }
                        })).then(() => updateUser(user, {
                            name: {
                                rich_text: [{text: {content: ctx.message.text}}]
                            },
                        })).then(() => ctx.reply("Ок, тепер зватиму тебе " + ctx.message.text, WANT_TO_TELL_MARKUP)))
                    } else if (ctx.message.reply_to_message.text === PROMPT_EMAIL_MESSAGE && ctx.message.text) {
                        return updateUser(user, {email: {email: ctx.message.text}}).then(() => {
                            ctx.reply(`${ctx.message.text} - записав. Скоро отримаєш лист!`);
                            ctx.telegram.sendMessage(ANN_SHEVCHENKO_ID, `${user.properties.telegramId.title[0].text.content} ${user.properties.email.email ? 'надав' : 'змінив'} свій email.`)
                                .then(() => ctx.telegram.sendMessage(ANN_SHEVCHENKO_ID, ctx.message.text))
                                .then(() => ctx.telegram.sendMessage(ANN_SHEVCHENKO_ID, user.properties.linkToPage.url))
                        })
                    } else if (ctx.message.reply_to_message.text === PROMPT_FEEDBACK) {
                        return messageToNotionBlocks(ctx)
                            .then(children => performWriteOperation(() => notion.blocks.children.append({
                                block_id: FEEDBACK_PAGE_ID, children: [{
                                    paragraph: {
                                        rich_text: [{text: {content: `Від @${ctx.chat.username} ${user.properties.telegramId.title[0].text.content}:`}}]
                                    }
                                }, ...children]
                            })))
                            .then(() => ctx.reply("Дякую за зворотній зв'язок!"))
                            .catch()
                    }
                } else {
                    return messageToNotionBlocks(ctx)
                        .then(children => performWriteOperation(() => notion.blocks.children.append({
                            block_id: user.properties.personalPageId.rich_text[0].text.content, children
                        })))
                        .then(() => ctx.reply('Дякую, записав', Markup.inlineKeyboard([Markup.button.callback(WANT_TO_ADD_ACTION, WANT_TO_ADD_ACTION), Markup.button.callback(THANKS_FOR_LISTENING_ACTION, THANKS_FOR_LISTENING_ACTION),], {columns: 1})))
                        .catch();
                }
            }
        }).catch(console.trace);
    })

// Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'))
    process.once('SIGTERM', () => bot.stop('SIGTERM'))

    function messageAllUsers(message, disable_notification = true) {
        notion.databases.query({
            database_id: USERS_TABLE_ID,
        }).then(({results}) => results.forEach(user => bot.telegram.sendMessage(user.properties.telegramId.title[0].text.content, message, {disable_notification}).catch()));
    }

    // notion.databases.query({
    //     database_id: USERS_TABLE_ID,
    // }).then(({results}) => results.forEach(user => notion.blocks.children.list({
    //     block_id: user.properties.personalPageId.rich_text[0].text.content
    // }).then(page => {
    //     if (!page.results.length) {
    //         return bot.telegram.sendMessage(user.properties.telegramId.title[0].text.content, `Привіт, ${user.properties.name.rich_text[0].text.content}\n` +
    //             'Бачу, що ти вже познайомився (-лась) зі мною, але нічого не пишеш\n' +
    //             'Може все ж розкажеш, як ти? Де ти?').catch(e => {
    //             console.log(user.properties.telegramId.title[0].text.content)
    //             console.error(e);
    //         })
    //     } else return Promise.resolve()
    // })))

    // messageAllUsers("Привіт! Пару годин тому мені було не дуже добре - вибач. Зараз мені вже краще і я готовий тебе слухати. А ще у мене оновився список команд:\n/about - про проект\n" +
    //     "/memories - мої спогади\n" +
    //     "/consent - перевірити згоду на використання матеріалів\n" +
    //     "/rename - змінити своє ім'я\n" +
    //     "/feedback - напиши нам")

} catch (e) {
    console.error(e)
}
