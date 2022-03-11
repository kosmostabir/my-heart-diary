export interface User {
    userId: number;
    name: string;
    consent: boolean;
}

export enum MessageType {
    TEXT = 0,
    IMAGE = 1,
    AUDIO = 2,
    VIDEO = 3,
    FILE = 4
}

export interface Message {
    userId: User['userId'];
    messageId: number;
    text: string;
    type: ''
}
