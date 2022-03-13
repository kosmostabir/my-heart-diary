export interface User {
    userId: number;
    name: string;
    consent?: boolean;
}

export enum MemoryType {
    TEXT = 0,
    IMAGE = 1,
    AUDIO = 2,
    VIDEO = 3,
    FILE = 4,
    VOICE = 5,
    VIDEO_NOTE = 6,
}

interface AbstractMessage {
    memoryId: number;
    userId: User['userId'];
    timestamp: number;
    type: MemoryType;
}

export interface TextMemory extends AbstractMessage {
    text: string;
    type: MemoryType.TEXT;
}

export interface DocumentMemory extends AbstractMessage {
    text?: string;
    type: Exclude<MemoryType, MemoryType.TEXT>;
    fileId: string;
    url?: string;
}

export type Memory = TextMemory | DocumentMemory;
