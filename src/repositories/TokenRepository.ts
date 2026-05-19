import { BaseRepository } from './BaseRepository';
import type { IRepository } from '../interfaces/db/IRepository';

export interface Token {
    id: string;
    userId: string;
    token: string;
    type: string;
    expiresAt: Date;
    createdAt?: Date;
}

export class TokenRepository extends BaseRepository<Token> implements IRepository<Token> {

    async findByValue(token: string): Promise<Token | null> {
        return this.findOne({ token });
    }


    async revokeAllForUser(userId: string): Promise<void> {
        const knexAdapter = this.adapter as any;
        if (knexAdapter.getKnex) {
            await knexAdapter.getKnex()('tokens').where({ user_id: userId }).delete();
            return;
        }
        const tokens = await this.findMany({ userId });
        await Promise.all(tokens.map(t => this.delete(t.id)));
    }
}
