import {Context, Markup, Telegraf} from 'telegraf';
import {Chat} from 'typegram';
import {UserService} from "./user.service";
import {ABOUT_PAGE, MEMORIES_PAGE} from "./constants";
import {Update} from "typegram/update";
import {CallbackQuery, Message} from "telegraf/typings/core/types/typegram";
import {Memory, MemoryType} from "./models";
import {MemoryService} from "./memory.service";

const DEV_ID = 230373802;
const CURATORS = JSON.parse(`[${process.env.CURATORS || DEV_ID}]`);

const MESSAGE_TYPE_TO_KEY: Record<MemoryType, string> = {
    [MemoryType.FILE]: 'document',
    [MemoryType.AUDIO]: 'audio',
    [MemoryType.TEXT]: 'text',
    [MemoryType.IMAGE]: 'photo',
    [MemoryType.VIDEO]: 'video',
    [MemoryType.VOICE]: 'voice',
    [MemoryType.VIDEO_NOTE]: 'video_note',
}

const UNKNOWN_MESSAGE_ERROR = 'Unprocessable Message';

const CONSENT_ACTION = 'consent';
const CONSENT_COMMAND = 'consent';
const ABOUT_COMMAND = 'about';
const MEMORIES_COMMAND = 'memories';
const FEEDBACK_COMMAND = 'feedback';
const RENAME_COMMAND = 'rename';
const REFUSE_ACTION = 'refuse';
const THANKS_FOR_LISTENING_ACTION = 'Дякую, що вислухав';
const PROMPT_FEEDBACK = 'Напиши нам:';
const PROMPT_NEW_NAME_MSG = 'Нове ім\'я:';
const WANT_TO_TELL_ACTION = 'Хочу щось розповісти';
const WANT_TO_ADD_ACTION = 'Хочу щось додати';

const WANT_TO_TELL_MARKUP = Markup.inlineKeyboard([Markup.button.callback(WANT_TO_TELL_ACTION, WANT_TO_TELL_ACTION)]);
const FORCE_REPLY_MARKUP = {reply_markup: {force_reply: true}} as const;

type BotContext = Context & { chat: Chat.PrivateChat };

const HOST = process.env.HEROKU_URL;
const TEST_BOT = '5120680530:AAGb1v6STa7StPE-m7v26gaCvc9oo3TjXqs'

export class Bot {
    public readonly token = process.env.BOT_TOKEN || TEST_BOT
    private bot = new Telegraf<BotContext>(this.token);

    constructor(
        private userService: UserService,
        private memoriesService: MemoryService,
    ) {
        this.bot.command('start', (ctx) => this.catchError(Promise.all([
                this.sendTypingStatus(ctx),
                this.userService.getUser(ctx.chat.id).then(user => {
                    if (user) {
                        return ctx.reply('Привіт, ' + user.name, WANT_TO_TELL_MARKUP);
                    } else {
                        this.bot.telegram.sendMessage(ctx.chat.id, 'Привіт, я існую задля збереження наших спільних спогадів, думок, переживань та рефлексій.')
                            .then(() => this.askUserName(ctx as BotContext));
                    }
                }),
            ])
        ));
        this.bot.command(FEEDBACK_COMMAND, ctx => this.catchError(ctx.reply(PROMPT_FEEDBACK, FORCE_REPLY_MARKUP)));
        this.bot.command(MEMORIES_COMMAND, ctx => this.catchError(ctx.reply(`${HOST}/${MEMORIES_PAGE}`)));
        this.bot.command(ABOUT_COMMAND, ctx => this.catchError(ctx.reply(`${HOST}/${ABOUT_PAGE}`)));
        this.bot.command(CONSENT_COMMAND, ctx => this.catchError(this.getUser(ctx).then(user => {
            if (user.consent) {
                return ctx.reply(`Дякую, ми вже маємо твою згоду. Більше тут /${ABOUT_PAGE}`)
            } else {
                return this.askForConsent(ctx)
            }
        })));
        this.bot.command(RENAME_COMMAND, ctx => this.catchError(ctx.reply(PROMPT_NEW_NAME_MSG, FORCE_REPLY_MARKUP)));

        this.bot.action(/rename.+/, ctx => {
            const name = (ctx.update.callback_query as CallbackQuery.DataCallbackQuery)?.data?.replace('rename', '')
            return this.catchError(this.userService.createUser({
                    userId: ctx.chat.id,
                    name,
                }).then(() => ctx.reply(`Радий знайомству, ${name}`)
                    .then(() => this.askForConsent(ctx)))
            );
        })
        this.bot.action(THANKS_FOR_LISTENING_ACTION, ctx => this.catchError(this.replyCallback(ctx,
            'Дякую, що не мовчиш ❤️',
            Markup.inlineKeyboard([Markup.button.callback(WANT_TO_TELL_ACTION, WANT_TO_TELL_ACTION)]))
        ));
        this.bot.action(WANT_TO_TELL_ACTION, ctx => this.catchError(this.replyCallback(ctx,
            'Я тебе уважно слухаю',
            Markup.removeKeyboard()
        )));
        this.bot.action(WANT_TO_ADD_ACTION, ctx => this.catchError(this.replyCallback(ctx,
            'Звісно, розповідай, будь ласка',
            Markup.removeKeyboard(),
        )));
        this.bot.action(REFUSE_ACTION, ctx => this.catchError(this.getUser(ctx).then(user => {
            if (user.consent) {
                return this.userService.updateUser({
                    ...user,
                    consent: true
                }).then(() => this.replyCallback(ctx,
                    'Ок, твої спогади залишаться у секреті.\nЯкщо захочеш, можеш дати згоду пізніше командою /consent',
                    WANT_TO_TELL_MARKUP
                )).then(() => CURATORS.forEach(curator =>
                    this.bot.telegram.sendMessage(curator, `${user.name} ${user.userId} відкликав згоду на використання матеріалів`)))
            } else {
                ctx.telegram.answerCbQuery(ctx.update.callback_query.id);
                ctx.reply('Не хвилюйся, твої спогади у секреті', WANT_TO_TELL_MARKUP);
            }
        })));
        this.bot.action(CONSENT_ACTION, ctx => this.catchError(this.getUser(ctx).then(user => {
            if (!user.consent) {
                return this.userService.updateUser({
                    ...user,
                    consent: true
                }).then(() => this.replyCallback(ctx, 'Дякую за твій внесок!', WANT_TO_TELL_MARKUP));
            } else {
                return this.replyCallback(ctx, 'Дякую, у мене вже є твоя згода', WANT_TO_TELL_MARKUP);
            }
        })));

        this.bot.on("message", ctx => this.catchError(this.getUser(ctx, false).then(user => {
            const message = ctx.message
            if (user) {
                const date = (message as Message.CommonMessage).forward_from?.id === ctx.chat.id
                    ? (message as Message.CommonMessage).forward_date
                    : message.date;
                return this.saveMessage(message, {
                    timestamp: date,
                    memoryId: message.message_id,
                    userId: ctx.chat.id,
                }).then(() => ctx.reply("Дякую, записав"))
                    .catch(e => {
                        if (e === UNKNOWN_MESSAGE_ERROR) {
                            return ctx.reply("Вибач, я поки не розумію такі повідомлення")
                                .then(() => ctx.telegram.sendMessage(DEV_ID, e))
                                .then(() => ctx.telegram.sendMessage(DEV_ID, JSON.stringify(ctx.message)));
                        }
                        throw e;
                    })
            } else {
                if (isTextMessage(message)) {
                    return this.userService.createUser({
                        userId: ctx.chat.id,
                        name: message.text,
                    }).then(() => ctx.reply(`Радий знайомству, ${message.text}`))
                        .then(() => this.askForConsent(ctx))
                } else {
                    return this.askUserName(ctx as BotContext)
                }
            }
        })))
    }

    public sendMessage(...params: Parameters<Telegraf['telegram']['sendMessage']>) {
        return this.bot.telegram.sendMessage(...params);
    }

    public enrichWithUrls(memories: Memory[]) {
        return Promise.all(memories.map(memory => memory.type === MemoryType.TEXT
            ? Promise.resolve(memory)
            : this.bot.telegram.getFileLink(memory.fileId).then(url => ({
                ...memory,
                url
            }))))
    }

    launch() {
        return this.bot.launch(process.env.NODE_ENV === 'production' ? {
            webhook: {
                domain: process.env.HEROKU_URL, port: Number(process.env.PORT)
            }
        } : {});
    }

    stop(sigint: string) {
        this.bot.stop(sigint)
    }

    private getUser(ctx: Context, promptRegister = true) {
        return this.userService.getUser(ctx.chat.id).then(user => {
            if (!user && promptRegister) {
                return this.askUserName(ctx as BotContext).then(() => Promise.reject())
            }
            return user;
        })
    }

    private askForConsent(ctx) {
        return ctx.reply(`Дозволиш використовувати твої спогади у арт-проєктах?\nПерсональні дані будуть оброблені згідно Закону України 2297-VI «Про захист персональних даних» від 13.02.2022 ст.6.\nБільше тут /${ABOUT_PAGE}`, Markup.inlineKeyboard([Markup.button.callback("Звісно!", CONSENT_ACTION), Markup.button.callback("Ні, вони лише для мене", REFUSE_ACTION),], {columns: 1}));
    }

    private catchError(promise: Promise<unknown>) {
        return promise.catch(this.logError)
    }

    private logError = e => console.trace(e);

    private sendTypingStatus(ctx) {
        return Promise.resolve()
    }

    private askUserName(ctx: BotContext) {
        try {
            const options = [ctx.chat.username];
            if (ctx.chat.username !== ctx.chat.first_name) {
                options.push(ctx.chat.first_name)
            }
            if (ctx.chat.last_name) {
                options.push(`${ctx.chat.first_name} ${ctx.chat.last_name}`)
            }
            return this.catchError(ctx.reply('Як тебе звати?',
                Markup.inlineKeyboard(options.filter(Boolean).map(name => Markup.button.callback(name, RENAME_COMMAND + name), {columns: 1})))
            )
        } catch (e) {
            this.logError(e)
        }
    }

    private replyCallback(ctx: Context<Update.CallbackQueryUpdate>, ...[text, extra]: Parameters<Context['reply']>) {
        return Promise.all([
            ctx.telegram.answerCbQuery(ctx.update.callback_query.id),
            this.bot.telegram.sendMessage(ctx.chat.id, text, extra),
        ]);
    }

    private saveMessage(message: Message, memoryBase: Omit<Memory, 'type'>) {
        if (isPhotoMessage(message)) {
            return this.memoriesService.addMemory({
                ...memoryBase,
                type: MemoryType.IMAGE,
                fileId: message.photo[message.photo.length - 1].file_id,
                text: message.caption
            })
        }
        if (isVoiceMessage(message)) {
            return this.memoriesService.addMemory({
                ...memoryBase,
                type: MemoryType.VOICE,
                fileId: message.voice.file_id,
            })
        }
        if (isVideoNoteMessage(message)) {
            return this.memoriesService.addMemory({
                ...memoryBase,
                fileId: message.video_note.file_id,
                type: MemoryType.VIDEO_NOTE
            })
        }
        if (isAudioMessage(message)) {
            return this.memoriesService.addMemory({
                ...memoryBase,
                type: MemoryType.AUDIO,
                fileId: message.audio.file_id,
                text: message.caption
            })
        }
        if (isVideoMessage(message)) {
            return this.memoriesService.addMemory({
                ...memoryBase,
                type: MemoryType.VIDEO,
                fileId: message.video.file_id,
                text: message.caption
            })
        }
        if (isFileMessage(message)) {
            return this.memoriesService.addMemory({
                ...memoryBase,
                type: MemoryType.VIDEO,
                fileId: message.document.file_id,
                text: message.caption
            })
        }
        if (isTextMessage(message)) {
            return this.memoriesService.addMemory({
                ...memoryBase,
                type: MemoryType.TEXT,
                text: message.text
            })
        }
        return Promise.reject(UNKNOWN_MESSAGE_ERROR)
    }
}

function hasKey(message: any, key: string): boolean {
    return message[key];
}

function isTextMessage(message: Message): message is Message.TextMessage {
    return hasKey(message, MESSAGE_TYPE_TO_KEY[MemoryType.TEXT])
}

function isAudioMessage(message: Message): message is Message.AudioMessage {
    return hasKey(message, MESSAGE_TYPE_TO_KEY[MemoryType.AUDIO])
}

function isVideoNoteMessage(message: Message): message is Message.VideoNoteMessage {
    return hasKey(message, MESSAGE_TYPE_TO_KEY[MemoryType.VIDEO_NOTE])
}

function isVoiceMessage(message: Message): message is Message.VoiceMessage {
    return hasKey(message, MESSAGE_TYPE_TO_KEY[MemoryType.VOICE])
}

function isPhotoMessage(message: Message): message is Message.PhotoMessage {
    return hasKey(message, MESSAGE_TYPE_TO_KEY[MemoryType.IMAGE])
}

function isVideoMessage(message: Message): message is Message.VideoMessage {
    return hasKey(message, MESSAGE_TYPE_TO_KEY[MemoryType.VIDEO])
}

function isFileMessage(message: Message): message is Message.DocumentMessage {
    return hasKey(message, MESSAGE_TYPE_TO_KEY[MemoryType.FILE])
}
