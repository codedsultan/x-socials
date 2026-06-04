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

    /**
     * Revoke all tokens for a user.
     *
     * Uses raw Knex for SQL (single DELETE WHERE user_id = ?) to avoid N
     * individual DELETE calls. Mongo path falls back to fetching IDs and
     * deleting each — Mongoose has no built-in deleteMany via BaseRepository.
     */
    async revokeAllForUser(userId: string): Promise<void> {
        const knexAdapter = this.adapter as any;
        if (knexAdapter.getKnex) {
            // SQL: single batch DELETE
            await knexAdapter.getKnex()('tokens').where({ user_id: userId }).delete();
            return;
        }
        // Mongo fallback: fetch ids + delete individually
        const tokens = await this.findMany({ userId });
        await Promise.all(tokens.map(t => this.delete(t.id)));
    }
}
