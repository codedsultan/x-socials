/**
 * @file src/models/sql/token.model.ts
 * @description SQL/Knex model for Auth Tokens
 */

import type { Knex } from "knex";
import type { IAuthTokenSQLRow, IAuthTokenSQLInsert, IAuthTokenSQLUpdate } from "../../interfaces/entities/auth/token";

export const TOKEN_TABLE = "auth_tokens";

export class TokenSQLModel {
    constructor(private knex: Knex) { }

    get table() {
        return this.knex(TOKEN_TABLE);
    }

    async findAll(limit?: number, offset?: number): Promise<IAuthTokenSQLRow[]> {
        let query = this.table.select("*");
        if (limit) query = query.limit(limit);
        if (offset) query = query.offset(offset);
        return query;
    }

    async findById(id: number): Promise<IAuthTokenSQLRow | undefined> {
        return this.table.where({ id }).first();
    }

    async findByToken(token: string): Promise<IAuthTokenSQLRow | undefined> {
        return this.table.where({ token }).first();
    }

    async findByUserId(userId: number): Promise<IAuthTokenSQLRow[]> {
        return this.table.where({ user_id: userId }).orderBy("created_at", "desc");
    }

    async findValidByUserId(userId: number): Promise<IAuthTokenSQLRow[]> {
        return this.table
            .where({ user_id: userId })
            .where("expires_at", ">", Date.now())
            .orderBy("created_at", "desc");
    }

    async create(data: IAuthTokenSQLInsert): Promise<IAuthTokenSQLRow> {
        const [token] = await this.table.insert(data).returning("*");
        return token;
    }

    async update(id: number, data: IAuthTokenSQLUpdate): Promise<IAuthTokenSQLRow | undefined> {
        const [token] = await this.table
            .where({ id })
            .update({ ...data, updated_at: new Date() })
            .returning("*");
        return token;
    }

    async delete(id: number): Promise<boolean> {
        const deleted = await this.table.where({ id }).delete();
        return deleted > 0;
    }

    async invalidateToken(id: number): Promise<boolean> {
        const updated = await this.table
            .where({ id })
            .where("expires_at", ">", Date.now())
            .update({
                expires_at: Date.now() - 1000,
                updated_at: new Date()
            });
        return updated > 0;
    }

    async invalidateAllForUser(userId: number, excludeTokenId?: number): Promise<number> {
        let query = this.table
            .where({ user_id: userId })
            .where("expires_at", ">", Date.now());

        if (excludeTokenId) {
            query = query.whereNot({ id: excludeTokenId });
        }

        const updated = await query.update({
            expires_at: Date.now() - 1000,
            updated_at: new Date()
        });

        return updated;
    }

    async cleanupExpiredTokens(): Promise<number> {
        const deleted = await this.table
            .where("expires_at", "<", Date.now())
            .delete();
        return deleted;
    }

    async isTokenValid(token: string): Promise<boolean> {
        const result = await this.table
            .where({ token })
            .where("expires_at", ">", Date.now())
            .first("id");
        return !!result;
    }

    async count(filters?: Partial<IAuthTokenSQLRow>): Promise<number> {
        let query = this.table.count("id as count");
        if (filters) {
            query = query.where(filters);
        }
        const result = await query.first();
        return parseInt((result?.count as string) || "0", 10);
    }
}