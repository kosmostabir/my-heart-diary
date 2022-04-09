import {Context, Markup, Telegraf} from 'telegraf';
import {Chat} from 'typegram';
import {UserService} from "./user.service";
import {ABOUT_PAGE, MEMORIES_PAGE} from "./constants";
import {Update} from "typegram/update";
import {CallbackQuery, Message} from "telegraf/typings/core/types/typegram";
import {Memory, MemoryType} from "./models";
import {MemoryService} from "./memory.service";
import {FeedbackService} from "./feedback.service";
import {I18nService} from "./I18n.service";

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

const CONSENT_COMMAND = 'consent';
const ABOUT_COMMAND = 'about';
const MEMORIES_COMMAND = 'memories';
const FEEDBACK_COMMAND = 'feedback';
const RENAME_COMMAND = 'rename';

const FORCE_REPLY_MARKUP = {reply_markup: {force_reply: true}} as const;

type BotContext = Context & { chat: Chat.PrivateChat };

const HOST = process.env.HEROKU_URL;

export class Bot {

    public readonly token = process.env.BOT_TOKEN;

    private bot = new Telegraf<BotContext>(this.token);

    constructor(
        private userService: UserService,
        private memoriesService: MemoryService,
        private feedbackService: FeedbackService,
        private i18n: I18nService,
    ) {

        this.bot.use(async (ctx, next) => {
            let user = await this.userService.getUser(ctx.chat.id);
            if(user && user.locale) {
                this.i18n.setLocale(user.locale);
            }
            return next();
        });

        this.bot.command('start', (ctx) => this.catchError(Promise.all([
                this.sendTypingStatus(ctx),
                this.userService.getUser(ctx.chat.id).then(user => {
                    if (user) {
                        return ctx.reply(
                            this.i18n.t(
                                'bot.start.exist.user',
                                {
                                    "name": user.name
                                }
                            ),
                            this.getWantToTellMarkUp()
                        );
                    } else {
                        this.bot.telegram.sendMessage(
                            ctx.chat.id,
                            this.i18n.t('bot.start.desc'),
                        ).then(() => this.askUserName(ctx as BotContext));
                    }
                }),
            ])));
        this.bot.command(FEEDBACK_COMMAND, ctx => this.catchError(ctx.reply(this.i18n.t('bot.button.feedback'), FORCE_REPLY_MARKUP)));
        this.bot.command(MEMORIES_COMMAND, ctx => this.catchError(ctx.reply(`${HOST}/${MEMORIES_PAGE}`)));
        this.bot.command(ABOUT_COMMAND, ctx => this.catchError(ctx.reply(`${HOST}/${ABOUT_PAGE}`)));
        this.bot.command(CONSENT_COMMAND, ctx => this.catchError(this.getUser(ctx).then(user => {
            if (user.consent) {
                return ctx.reply(this.i18n.t('bot.answer.consent.exist', {"command": ABOUT_COMMAND}))
            } else {
                return this.askForConsent(ctx)
            }
        })));

        this.bot.command(RENAME_COMMAND,ctx => this.catchError(ctx.reply(this.i18n.t('bot.rename'), FORCE_REPLY_MARKUP)));

        this.bot.action(/rename.+/, ctx => {
            const name = (ctx.update.callback_query as CallbackQuery.DataCallbackQuery)?.data?.replace('rename', '')
            return this.catchError(this.userService.createUser({
                    userId: ctx.chat.id,
                    name,
                }).then(() => ctx.reply(this.i18n.t('bot.set.name.success', {"name": name}))
                    .then(() => this.askForConsent(ctx)))
            );
        })

        this.bot.action(this.i18n.t('bot.button.thanks.for.listening'), ctx => this.catchError(this.replyCallback(ctx,
            this.i18n.t('bot.answer.thanks.for.listening'),
            Markup.inlineKeyboard([Markup.button.callback(this.i18n.t('bot.button.want.to.tell'), this.i18n.t('bot.button.want.to.tell'))]))
        ));

        this.bot.action(this.i18n.t('bot.button.want.to.tell'), ctx => this.catchError(this.replyCallback(ctx,
            this.i18n.t('bot.answer.want.tell'),
            Markup.removeKeyboard()
        )));

        this.bot.action(this.i18n.t('bot.button.want.add'), ctx => this.catchError(this.replyCallback(ctx,
            this.i18n.t('bot.answer.want.add'),
            Markup.removeKeyboard(),
        )));

        this.bot.action(this.i18n.t('bot.button.refuse'), ctx => this.catchError(this.getUser(ctx).then(user => {
            if (user.consent) {
                return this.userService.updateUser({
                    ...user,
                    consent: true
                }).then(() => this.replyCallback(ctx,
                    this.i18n.t('bot.answer.refuse.for.user', {"command": CONSENT_COMMAND}),
                    this.getWantToTellMarkUp()
                )).then(() => CURATORS.forEach(curator =>
                    this.bot.telegram.sendMessage(
                        curator,
                        this.i18n.t(
                            'bot.answer.refuse.for.curator',
                            {"name": user.name, "userId": user.userId}
                        )
                    )))
            } else {
                ctx.telegram.answerCbQuery(ctx.update.callback_query.id);
                ctx.reply(this.i18n.t('bot.answer.dont.refuse'), this.getWantToTellMarkUp());
            }
        })));

        this.bot.action(this.i18n.t('bot.button.consent'), ctx => this.catchError(this.getUser(ctx).then(user => {
            if (!user.consent) {
                return this.userService.updateUser({
                    ...user,
                    consent: true
                }).then(() => this.replyCallback(ctx, this.i18n.t('bot.answer.consent.add'), this.getWantToTellMarkUp()));
            } else {
                return this.replyCallback(ctx, this.i18n.t('bot.answer.consent.exist'), this.getWantToTellMarkUp());
            }
        })));

        this.bot.on("message", ctx => this.catchError(this.getUser(ctx, false).then(user => {
            const message = ctx.message
            if (user) {
                if (this.tryHandleFeedbackMessage(message, ctx)) {

                } else {
                    const date = (message as Message.CommonMessage).forward_from?.id === ctx.chat.id
                        ? (message as Message.CommonMessage).forward_date
                        : message.date;
                    return this.memoriesService.addMemory(this.prepareMessage(message, {
                        timestamp: date,
                        id: message.message_id,
                        userId: ctx.chat.id,
                    })).then(() => ctx.reply(this.i18n.t('memory.add.success')))
                        .catch(e => {
                            if (e === UNKNOWN_MESSAGE_ERROR) {
                                return ctx.reply(this.i18n.t('bot.answer.dont.understand'))
                                    .then(() => ctx.telegram.sendMessage(DEV_ID, e))
                                    .then(() => ctx.telegram.sendMessage(DEV_ID, JSON.stringify(ctx.message)));
                            }
                            throw e;
                        })
                }
            } else {
                if (isTextMessage(message)) {
                    return this.userService.createUser({
                        userId: ctx.chat.id,
                        name: message.text,
                    }).then(() => ctx.reply(this.i18n.t('bot.set.name.success', {"name": message.text})))
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

    public handleUpdate(...params: Parameters<Telegraf['handleUpdate']>) {
        return this.bot.handleUpdate(...params);
    }

    public enrichWithUrls(memories: Memory[]) {
        return Promise.all(memories.map(memory => memory.type === MemoryType.TEXT
            ? Promise.resolve(memory)
            : this.bot.telegram.getFileLink(memory.fileId).then(url => ({
                ...memory,
                url
            })).catch(() => memory)))
    }

    launch() {
        if (process.env.NODE_ENV === 'production') {
            return this.bot.telegram.setWebhook(`${process.env.HEROKU_URL}/${this.token}`);
        } else {
            return this.bot.launch();
        }
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

    private getWantToTellMarkUp() {
        return Markup.inlineKeyboard(
            [
                Markup.button.callback(
                    this.i18n.t('bot.button.want.to.tell'),
                    this.i18n.t('bot.button.want.to.tell')
                )
            ]
        );
    }

    private askForConsent(ctx) {
        return ctx.reply(
            this.i18n.t('bot.consent.text', {"command": ABOUT_PAGE}),
            Markup.inlineKeyboard(
                [
                    Markup.button.callback(this.i18n.t('bot.consent.agree'), this.i18n.t('bot.button.consent')),
                    Markup.button.callback(this.i18n.t('bot.consent.disagree'), this.i18n.t('bot.button.refuse')),
                ],
                {
                    columns: 1
                }
            )
        );
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
            return this.catchError(
                ctx.reply(
                    this.i18n.t('bot.what.you.name'),
                    Markup.inlineKeyboard(
                        options.filter(Boolean)
                            .map(
                                name => Markup.button.callback(name, RENAME_COMMAND + name),
                                {columns: 1}
                            )
                    )
                )
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

    private prepareMessage(message: Message, memoryBase: Omit<Memory, 'type'>) {
        if (isPhotoMessage(message)) {
            return {
                ...memoryBase,
                type: MemoryType.IMAGE,
                fileId: message.photo[message.photo.length - 1].file_id,
                text: message.caption
            } as const;
        }
        if (isVoiceMessage(message)) {
            return {
                ...memoryBase,
                type: MemoryType.VOICE,
                fileId: message.voice.file_id,
            } as const;
        }
        if (isVideoNoteMessage(message)) {
            return {
                ...memoryBase,
                fileId: message.video_note.file_id,
                type: MemoryType.VIDEO_NOTE
            } as const;
        }
        if (isAudioMessage(message)) {
            return {
                ...memoryBase,
                type: MemoryType.AUDIO,
                fileId: message.audio.file_id,
                text: message.caption
            } as const;
        }
        if (isVideoMessage(message)) {
            return {
                ...memoryBase,
                type: MemoryType.VIDEO,
                fileId: message.video.file_id,
                text: message.caption
            } as const;
        }
        if (isFileMessage(message)) {
            return {
                ...memoryBase,
                type: MemoryType.VIDEO,
                fileId: message.document.file_id,
                text: message.caption
            } as const;
        }
        if (isTextMessage(message)) {
            return {
                ...memoryBase,
                type: MemoryType.TEXT,
                text: message.text
            } as const;
        }
        throw Error(UNKNOWN_MESSAGE_ERROR);
    }

    private tryHandleFeedbackMessage(message: Message, ctx: Context) {
        const msg = message as Message.CommonMessage;
        try {
            if ((msg.reply_to_message as Message.TextMessage)?.text === this.i18n.t('bot.button.feedback')) {
                if (CURATORS.includes(message.from.id)) {
                    this.userService.getUsers().then(users => {
                        users.forEach(user => this.bot.telegram.sendMessage(user.userId, (message as Message.TextMessage).text.replace("$user", user.name)).catch())
                    })
                } else {
                    this.feedbackService.addFeedback(this.prepareMessage(message, {
                        userId: ctx.chat.id,
                        timestamp: message.date,
                        id: message.message_id
                    })).then(() => ctx.reply(this.i18n.t('bot.feedback.thank'))).catch()
                }
                return true
            }
        } catch (e) {

        }
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
