/**
 * @file src/models/sql/user.model.ts
 * @description SQL/Knex model for Users
 */

import type { Knex } from "knex";
import type { IUserSQLRow, IUserSQLInsert, IUserSQLUpdate } from "../../interfaces/entities/user/sql";

export const USER_TABLE = "users";

export class UserSQLModel {
    constructor(private knex: Knex) { }

    get table() {
        return this.knex(USER_TABLE);
    }

    async findAll(limit?: number, offset?: number): Promise<IUserSQLRow[]> {
        let query = this.table.select("*");
        if (limit) query = query.limit(limit);
        if (offset) query = query.offset(offset);
        return query;
    }

    async findById(id: number): Promise<IUserSQLRow | undefined> {
        return this.table.where({ id }).first();
    }

    async findByEmail(email: string): Promise<IUserSQLRow | undefined> {
        return this.table.where({ email }).first();
    }

    async findByUsername(username: string): Promise<IUserSQLRow | undefined> {
        return this.table.where({ username }).first();
    }

    async create(data: IUserSQLInsert): Promise<IUserSQLRow> {
        const [user] = await this.table.insert(data).returning("*");
        return user;
    }

    async update(id: number, data: IUserSQLUpdate): Promise<IUserSQLRow | undefined> {
        const [user] = await this.table
            .where({ id })
            .update({ ...data, updated_at: new Date() })
            .returning("*");
        return user;
    }

    async delete(id: number): Promise<boolean> {
        const deleted = await this.table.where({ id }).delete();
        return deleted > 0;
    }

    async count(filters?: Partial<IUserSQLRow>): Promise<number> {
        let query = this.table.count("id as count");
        if (filters) {
            query = query.where(filters);
        }
        const result = await query.first();
        return parseInt((result?.count as string) || "0", 10);
    }
}