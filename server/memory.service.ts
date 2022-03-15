import {DocumentMemory, Memory, User} from "./models";
import {PoolClient} from "pg";

export class MemoryService {
    constructor(private client: PoolClient) {
    }

    public getMemories(userId: User['userId']) {
        return this.client.query<Memory>('SELECT * from memories where "userId" = $1 ORDER BY timestamp', [userId])
            .then(result => result.rows)
    }

    public addMemory({
                         userId,
                         id,
                         text,
                         fileId,
                         type,
                         timestamp
                     }: Memory & Partial<Pick<DocumentMemory, 'fileId'>>) {
        return this.client.query(`INSERT into memories ("userId", id, text, type, "fileId", timestamp)
                                  VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, id, text, type, fileId, timestamp])
    }
}
