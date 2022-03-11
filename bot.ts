import {Context, Markup, Telegraf} from 'telegraf';
import {Pool} from 'pg';
import {User} from "./models";

const CONSENT_ACTION = 'consent';
const CONSENT_COMMAND = 'consent';
const ABOUT_COMMAND = 'about';
const MEMORIES_COMMAND = 'memories';
const FEEDBACK_COMMAND = 'feedback';
const RENAME_COMMAND = 'rename';
const REFUSE_ACTION = 'refuse';
const CHANGE_EMAIL_ACTION = 'Змінити email';
const THANKS_FOR_LISTENING_ACTION = 'Дякую, що вислухав';
const PROMPT_FEEDBACK = 'Напиши нам:';
const PROMPT_NEW_NAME_MSG = 'Нове ім\'я:';
const PROMPT_EMAIL_MESSAGE = 'Якщо хочеш переглядати свої спогади, надай свій email у відповідь на це повідомлення.';
const WANT_TO_TELL_ACTION = 'Хочу щось розповісти';
const WANT_TO_ADD_ACTION = 'Хочу щось додати';

const WANT_TO_TELL_MARKUP = Markup.inlineKeyboard([Markup.button.callback(WANT_TO_TELL_ACTION, WANT_TO_TELL_ACTION)]);
const FORCE_REPLY_MARKUP = {reply_markup: {force_reply: true}};


export class Bot {
    private bot = new Telegraf(process.env.BOT_TOKEN);
    private client = new Pool({
        user: 'wuhrjfjtmudiqp',
        host: 'ec2-176-34-222-188.eu-west-1.compute.amazonaws.com',
        database: 'dbspnn7f3bak4t',
        password: '3ff8acac992d3505dd7aa5417b983355f2570d42068972785e3d5a739945b968',
        port: 5432,
        ssl: {rejectUnauthorized: false}
    });

    constructor() {
        this.bot.command('start', ctx => {
            this.sendTypingStatus(ctx);

            notion.databases.query({
                database_id: USERS_TABLE_ID, filter: {
                    property: 'telegramId', title: {
                        equals: String(ctx.chat.id)
                    }
                }
            }).then(({results}) => {
                if (!results.length) {
                    this.bot.telegram.sendMessage(ctx.chat.id, 'Привіт, я існую задля збереження наших спільних спогадів, думок, переживань та рефлексій.')
                        .then(() => askUserName(ctx));
                } else {
                    return ctx.reply('Привіт, ' + results[0].properties.name.rich_text[0].text.content, WANT_TO_TELL_MARKUP);
                    // return getUser(ctx).then(user => {
                    //     if (!user.properties.consent.checkbox) {
                    //         askForConsent(ctx)
                    //     }
                    //     if (!user.properties.email.email) {
                    //         promptEmail(ctx)
                    //     }
                    // })
                }
            }).catch(console.trace);
        });
        this.bot.command(FEEDBACK_COMMAND, ctx => ctx.reply(PROMPT_FEEDBACK, FORCE_REPLY_MARKUP).catch(console.trace));
        this.bot.command(MEMORIES_COMMAND, ctx => getUser(ctx).then(user => {
            if (user.properties.email.email) {
                ctx.reply(`Твій email ${user.properties.email.email}\n${user.properties.linkToPage.url}`, Markup.inlineKeyboard([Markup.button.callback(CHANGE_EMAIL_ACTION, CHANGE_EMAIL_ACTION)]));
            } else return promptEmail(ctx);
        }).catch(console.trace));
        this.bot.command(ABOUT_COMMAND, ctx => ctx.reply('https://youcantellme.notion.site/fc93ec4ebf154f7c821b845f72067694').catch(console.trace));
        this.bot.command(CONSENT_COMMAND, askForConsent);
        this.bot.command(RENAME_COMMAND, ctx => ctx.reply(PROMPT_NEW_NAME_MSG, FORCE_REPLY_MARKUP).catch(console.trace));

        this.bot.action(CHANGE_EMAIL_ACTION, ctx => {
            ctx.telegram.answerCbQuery(ctx.update.callback_query.id).catch(console.trace);
            promptEmail(ctx);
        });
        this.bot.action(THANKS_FOR_LISTENING_ACTION, ctx => {
            ctx.telegram.answerCbQuery(ctx.update.callback_query.id).catch(console.trace);
            ctx.reply('Дякую, що не мовчиш ❤️', Markup.inlineKeyboard([Markup.button.callback(WANT_TO_TELL_ACTION, WANT_TO_TELL_ACTION)])).catch(console.trace);
        });
        this.bot.action(WANT_TO_TELL_ACTION, ctx => {
            ctx.telegram.answerCbQuery(ctx.update.callback_query.id).catch(console.trace);
            ctx.reply('Я тебе уважно слухаю', Markup.removeKeyboard()).catch(console.trace);
        });
        this.bot.action(WANT_TO_ADD_ACTION, ctx => {
            ctx.telegram.answerCbQuery(ctx.update.callback_query.id).catch(console.trace);
            ctx.reply('Звісно, розповідай, будь ласка', Markup.removeKeyboard()).catch(console.trace);
        });
        this.bot.action(REFUSE_ACTION, ctx => getUser(ctx).then(user => {
            if (user.properties.consent.checkbox) {
                this.sendTypingStatus(ctx);
                return updateUser(user, {
                    consent: {checkbox: false}
                }).then(() => {
                    ctx.telegram.answerCbQuery(ctx.update.callback_query.id);
                    ctx.reply('Ок, твої спогади залишаться у секреті.\nЯкщо захочеш, можеш дати згоду пізніше командою /consent', WANT_TO_TELL_MARKUP);
                    CURATORS.forEach(curator => this.bot.telegram.sendMessage(curator, `${user.properties.name.rich_text[0].text.content} ${user.properties.telegramId.title[0].text.content} відкликала згоду на використання матеріалів`));
                });
            } else {
                ctx.telegram.answerCbQuery(ctx.update.callback_query.id);
                ctx.reply('Не хвилюйся, твої спогади у секреті', WANT_TO_TELL_MARKUP);
            }
        }).catch(console.trace));
        this.bot.action(CONSENT_ACTION, ctx => getUser(ctx).then(user => {
            if (!user.properties.consent.checkbox) {
                this.sendTypingStatus(ctx);
                return updateUser(user, {
                    consent: {checkbox: true}
                }).then(() => {
                    ctx.telegram.answerCbQuery(ctx.update.callback_query.id);
                    ctx.reply('Дякую за твій внесок!', WANT_TO_TELL_MARKUP);
                });
            } else {
                ctx.telegram.answerCbQuery(ctx.update.callback_query.id);
                ctx.reply('Дякую, у мене вже є твоя згода', WANT_TO_TELL_MARKUP);
            }
        }).catch(console.trace));
    }

    launch() {
        return this.bot.launch(process.env.NODE_ENV === 'production' ? {
            webhook: {
                domain: process.env.HEROKU_URL, port: Number(process.env.PORT)
            }
        } : {});
    }

    private getUser(ctx: Context) {
        return this.client.query<User>('SELECT * from users where userId = $1', [ctx.chat.id])
            .then(result => result.rows[0])
    }

    private sendTypingStatus(ctx) {

    }
}
