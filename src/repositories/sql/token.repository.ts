/**
 * @file src/repositories/sql/token.repository.ts
 * @description SQL (PostgreSQL) implementation for Auth Tokens
 */

import DbManager from "../../config/db/DbManager";
import { KnexAdapter } from "../../config/db/adapters/KnexAdapter";
import type { ITokenRepository } from "../../interfaces/repositories/token.repository";
import type { IAuthToken, TokenType } from "../../interfaces/entities/auth/token";
import type { IAuthTokenSQLRow, IAuthTokenSQLInsert } from "../../interfaces/entities/auth/token";
import type { Knex } from "knex";

export class SQLTokenRepository implements ITokenRepository {
    private get adapter(): KnexAdapter {
        const adapter = DbManager.getInstance().resolveForModel("TokenModel");
        if (!adapter) {
            throw new Error("TokenModel not bound to any connection. Call DbManager.bindModel() first.");
        }
        if (!(adapter instanceof KnexAdapter)) {
            throw new Error("TokenModel is not bound to a SQL/Knex connection");
        }
        return adapter as KnexAdapter;
    }

    private get knex(): Knex {
        const client = this.adapter.getClient();
        if (!client) {
            throw new Error("Knex client not initialized. Check your database connection.");
        }
        return client as Knex;
    }

    private get tableName() {
        return "auth_tokens";
    }

    async create(tokenData: Omit<IAuthToken, 'id' | 'createdAt' | 'updatedAt'>): Promise<IAuthToken> {
        const insertData: IAuthTokenSQLInsert = {
            token: tokenData.token,
            user_id: parseInt(tokenData.userId, 10),
            type: tokenData.type || 'access',
            expires_at: tokenData.expiresAt
        };

        const [token] = await this.knex(this.tableName)
            .insert(insertData)
            .returning("*");

        return this.toCore(token);
    }

    async findById(id: string | number): Promise<IAuthToken | null> {
        const tokenId = typeof id === 'string' ? parseInt(id, 10) : id;
        const token = await this.knex(this.tableName)
            .where({ id: tokenId })
            .first();

        return token ? this.toCore(token) : null;
    }

    async findByToken(token: string): Promise<IAuthToken | null> {
        const result = await this.knex(this.tableName)
            .where({ token })
            .first();

        return result ? this.toCore(result) : null;
    }

    async findByUserId(userId: string | number, options?: { type?: TokenType; isValid?: boolean }): Promise<IAuthToken[]> {
        const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
        let query = this.knex(this.tableName).where({ user_id: userIdNum });

        if (options?.type) {
            query = query.where({ type: options.type });
        }

        if (options?.isValid === true) {
            query = query.where('expires_at', '>', Date.now());
        }

        const tokens = await query.orderBy('created_at', 'desc');
        return tokens.map((t: IAuthTokenSQLRow) => this.toCore(t));
    }

    async findAllValidForUser(userId: string | number): Promise<IAuthToken[]> {
        return this.findByUserId(userId, { isValid: true });
    }

    async update(id: string | number, updates: Partial<Omit<IAuthToken, 'id' | 'createdAt'>>): Promise<IAuthToken | null> {
        const tokenId = typeof id === 'string' ? parseInt(id, 10) : id;
        const updateData: any = {};

        if (updates.token) updateData.token = updates.token;
        if (updates.userId) updateData.user_id = parseInt(updates.userId, 10);
        if (updates.type) updateData.type = updates.type;
        if (updates.expiresAt !== undefined) updateData.expires_at = updates.expiresAt;

        updateData.updated_at = new Date();

        const [token] = await this.knex(this.tableName)
            .where({ id: tokenId })
            .update(updateData)
            .returning("*");

        return token ? this.toCore(token) : null;
    }

    async delete(id: string | number): Promise<boolean> {
        const tokenId = typeof id === 'string' ? parseInt(id, 10) : id;
        const deleted = await this.knex(this.tableName)
            .where({ id: tokenId })
            .delete();

        return deleted > 0;
    }

    async invalidateToken(id: string | number): Promise<boolean> {
        const tokenId = typeof id === 'string' ? parseInt(id, 10) : id;
        const updated = await this.knex(this.tableName)
            .where({ id: tokenId })
            .update({
                expires_at: Date.now() - 1000,
                updated_at: new Date()
            });

        return updated > 0;
    }

    async invalidateAllForUser(userId: string | number, excludeTokenId?: string | number): Promise<number> {
        const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
        let query = this.knex(this.tableName)
            .where({ user_id: userIdNum })
            .where('expires_at', '>', Date.now());

        if (excludeTokenId) {
            const excludeId = typeof excludeTokenId === 'string' ? parseInt(excludeTokenId, 10) : excludeTokenId;
            query = query.whereNot({ id: excludeId });
        }

        const updated = await query.update({
            expires_at: Date.now() - 1000,
            updated_at: new Date()
        });

        return updated;
    }

    async cleanupExpiredTokens(): Promise<number> {
        const deleted = await this.knex(this.tableName)
            .where('expires_at', '<', Date.now())
            .delete();

        return deleted;
    }

    async refreshToken(oldTokenId: string | number, newTokenData: Omit<IAuthToken, 'id' | 'createdAt' | 'updatedAt'>): Promise<IAuthToken> {
        // Invalidate old token
        await this.invalidateToken(oldTokenId);
        // Create new token
        return this.create(newTokenData);
    }

    async count(filters?: Partial<IAuthToken>): Promise<number> {
        let query = this.knex(this.tableName).count("id as count");

        if (filters) {
            if (filters.token) query = query.where({ token: filters.token });
            if (filters.userId) query = query.where({ user_id: parseInt(filters.userId, 10) });
            if (filters.type) query = query.where({ type: filters.type });
            if (filters.expiresAt !== undefined) query = query.where('expires_at', filters.expiresAt);
        }

        const result = await query.first();
        const count = result?.count;

        if (typeof count === 'number') return count;
        return parseInt(count || "0", 10);
    }

    async exists(token: string): Promise<boolean> {
        const result = await this.knex(this.tableName)
            .where({ token })
            .first('id');

        return !!result;
    }

    async isTokenValid(token: string): Promise<boolean> {
        const result = await this.knex(this.tableName)
            .where({
                token,
                expires_at: { '>': Date.now() }
            })
            .first('id');

        return !!result;
    }

    private toCore(row: IAuthTokenSQLRow): IAuthToken {
        return {
            id: row.id.toString(),
            token: row.token,
            userId: row.user_id.toString(),
            type: row.type,
            expiresAt: row.expires_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}