import {DocumentMemory, Memory, User} from "./models";
import {PoolClient} from "pg";
import {Message} from "telegraf/typings/core/types/typegram";

export class MemoryService {
    constructor(private client: PoolClient) {
    }

    public getMemories(userId: User['userId']) {
        return this.client.query<Message>('SELECT * from memories where "userId" = $1', [userId])
            .then(result => result.rows)
    }

    public addMemory({userId, memoryId, text, file, type, timestamp}: Memory & Partial<Pick<DocumentMemory, 'file'>>) {
        return this.client.query(`INSERT into memories ("userId", "memoryId", text, type, "fileId", timestamp)
                                  VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, memoryId, text, type, file, timestamp])
    }
}
