import {User} from "./models";
import {PoolClient} from "pg";

export class UserService {
    constructor(private client: PoolClient) {
    }

    public getUsers() {
        return this.client.query<User>('select * from users')
            .then(result => result.rows)
    }

    public getUser(userId: User['userId']) {
        return this.client.query<User>('SELECT * from users where "userId" = $1', [userId])
            .then(result => result.rows[0])
    }

    public createUser({userId, name, consent}: User) {
        return this.client.query('INSERT into users ("userId", name, consent) VALUES ($1,$2,$3) ON CONFLICT ("userId") DO UPDATE set name = $2', [userId, name, consent])
    }

    public updateUser({name, consent, userId}: User) {
        return this.client.query('UPDATE users SET name=$1,consent=$2 WHERE "userId"=$3', [name, consent, userId])
    }
}
