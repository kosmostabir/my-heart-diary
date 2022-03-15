import {DocumentMemory, Memory} from "./models";
import {PoolClient} from "pg";

export class FeedbackService {
    constructor(private client: PoolClient) {
    }

    public getFeedback() {
        return this.client.query<Memory>('SELECT * from memories ORDER BY timestamp')
            .then(result => result.rows)
    }

    public addFeedback({
                           userId,
                           id,
                           text,
                           fileId,
                           type,
                           timestamp
                       }: Memory & Partial<Pick<DocumentMemory, 'fileId'>>) {
        return this.client.query(`INSERT into feedback ("userId", id, text, type, "fileId", timestamp)
                                  VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, id, text, type, fileId, timestamp])
    }
}
