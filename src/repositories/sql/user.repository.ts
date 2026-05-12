/**
 * @file src/repositories/sql/user.repository.ts
 * @description SQL (PostgreSQL) implementation using your DbManager
 */

import DbManager from "../../config/db/DbManager";
import { KnexAdapter } from "../../config/db/adapters/KnexAdapter";
import type { IUserRepository } from "../../interfaces/repositories/user.repository";
import type { IUser } from "../../interfaces/entities/user/core";
import type { IUserSQLRow, IUserSQLInsert } from "../../interfaces/entities/user/sql";
import type { Knex } from "knex";

export class SQLUserRepository implements IUserRepository {
    private get adapter(): KnexAdapter {
        // Resolve the PostgreSQL connection that was bound to UserModel
        const adapter = DbManager.getInstance().resolveForModel("UserModel");

        if (!adapter) {
            throw new Error("UserModel not bound to any connection. Call DbManager.bindModel() first.");
        }

        if (!(adapter instanceof KnexAdapter)) {
            throw new Error("UserModel is not bound to a SQL/Knex connection");
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
        return "users";
    }

    async findById(id: string | number): Promise<IUser | null> {
        const userId = typeof id === 'string' ? parseInt(id, 10) : id;
        const user = await this.knex(this.tableName)
            .where({ id: userId })
            .first();
        return user ? this.toCoreUser(user) : null;
    }

    async findByEmail(email: string): Promise<IUser | null> {
        const user = await this.knex(this.tableName)
            .where({ email })
            .first();
        return user ? this.toCoreUser(user) : null;
    }

    async findByUsername(username: string): Promise<IUser | null> {
        const user = await this.knex(this.tableName)
            .where({ username })
            .first();
        return user ? this.toCoreUser(user) : null;
    }

    async create(userData: Partial<IUser>): Promise<IUser> {
        const [user] = await this.knex(this.tableName)
            .insert(this.toSQLInsert(userData))
            .returning("*");
        return this.toCoreUser(user);
    }

    async update(id: string | number, updates: Partial<IUser>): Promise<IUser | null> {
        const userId = typeof id === 'string' ? parseInt(id, 10) : id;
        const [user] = await this.knex(this.tableName)
            .where({ id: userId })
            .update(this.toSQLUpdate(updates))
            .returning("*");
        return user ? this.toCoreUser(user) : null;
    }

    async delete(id: string | number): Promise<boolean> {
        const userId = typeof id === 'string' ? parseInt(id, 10) : id;
        const deleted = await this.knex(this.tableName)
            .where({ id: userId })
            .delete();
        return deleted > 0;
    }

    async findAll(options?: { limit?: number; offset?: number }): Promise<IUser[]> {
        let query = this.knex(this.tableName).select("*");
        if (options?.limit) query = query.limit(options.limit);
        if (options?.offset) query = query.offset(options.offset);

        const users = await query;
        return users.map((u: IUserSQLRow) => this.toCoreUser(u));
    }

    async count(filters?: Partial<IUser>): Promise<number> {
        let query = this.knex(this.tableName).count("id as count");

        if (filters) {
            const sqlFilters: any = {};

            for (const [key, value] of Object.entries(filters)) {
                if (value === undefined || value === null) continue;

                // Skip id field entirely for count operations
                if (key === 'id') continue;

                // Map field names
                if (key === 'createdAt') {
                    sqlFilters.created_at = value;
                } else if (key === 'updatedAt') {
                    sqlFilters.updated_at = value;
                } else {
                    // For other fields, use the key as-is (they should match SQL column names)
                    sqlFilters[key] = value;
                }
            }

            if (Object.keys(sqlFilters).length > 0) {
                query = query.where(sqlFilters);
            }
        }

        const result = await query.first();
        const count = result?.count;

        if (typeof count === 'number') {
            return count;
        }

        return parseInt(count || "0", 10);
    }

    async verifyEmail(id: string | number): Promise<IUser | null> {
        const userId = typeof id === 'string' ? parseInt(id, 10) : id;
        const [user] = await this.knex(this.tableName)
            .where({ id: userId })
            .update({
                isEmailVerified: true,
                isVerified: true,
                updated_at: new Date()
            })
            .returning("*");
        return user ? this.toCoreUser(user) : null;
    }

    async updatePassword(id: string | number, hashedPassword: string): Promise<IUser | null> {
        const userId = typeof id === 'string' ? parseInt(id, 10) : id;
        const [user] = await this.knex(this.tableName)
            .where({ id: userId })
            .update({
                password: hashedPassword,
                passwordChangedAt: new Date(),
                updated_at: new Date()
            })
            .returning("*");
        return user ? this.toCoreUser(user) : null;
    }

    async updateRole(id: string | number, role: IUser['role']): Promise<IUser | null> {
        const userId = typeof id === 'string' ? parseInt(id, 10) : id;
        const [user] = await this.knex(this.tableName)
            .where({ id: userId })
            .update({
                role,
                updated_at: new Date()
            })
            .returning("*");
        return user ? this.toCoreUser(user) : null;
    }

    private toCoreUser(sqlUser: IUserSQLRow): IUser {
        return {
            id: sqlUser.id.toString(),
            fname: sqlUser.fname,
            lname: sqlUser.lname,
            email: sqlUser.email,
            isEmailVerified: sqlUser.isEmailVerified,
            username: sqlUser.username,
            role: sqlUser.role,
            password: sqlUser.password,
            salt: sqlUser.salt,
            accountStatus: sqlUser.accountStatus,
            isVerified: sqlUser.isVerified,
            isPrivate: sqlUser.isPrivate,
            countryCode: sqlUser.countryCode,
            phone: sqlUser.phone,
            isPhoneVerified: sqlUser.isPhoneVerified,
            about: sqlUser.about,
            gender: sqlUser.gender,
            dob: sqlUser.dob,
            profession: sqlUser.profession,
            location: sqlUser.location,
            website: sqlUser.website,
            avatarPublicId: sqlUser.avatarPublicId,
            avatarUrl: sqlUser.avatarUrl,
            nameChangedAt: sqlUser.nameChangedAt,
            emailChangedAt: sqlUser.emailChangedAt,
            usernameChangedAt: sqlUser.usernameChangedAt,
            passwordChangedAt: sqlUser.passwordChangedAt,
            phoneChangedAt: sqlUser.phoneChangedAt,
            createdAt: sqlUser.created_at,
            updatedAt: sqlUser.updated_at,
        };
    }

    private toSQLInsert(user: Partial<IUser>): IUserSQLInsert {
        const insert: any = { ...user };

        // Convert field names
        if (user.createdAt) insert.created_at = user.createdAt;
        if (user.updatedAt) insert.updated_at = user.updatedAt;

        // Remove IUser-specific fields that don't exist in SQL
        delete insert.id;
        delete insert.createdAt;
        delete insert.updatedAt;

        return insert as IUserSQLInsert;
    }

    private toSQLUpdate(updates: Partial<IUser>): Partial<IUserSQLInsert> {
        const update: any = { ...updates };

        // Convert field names
        if (updates.createdAt) update.created_at = updates.createdAt;
        if (updates.updatedAt) update.updated_at = updates.updatedAt;

        // Remove IUser-specific fields
        delete update.id;
        delete update.createdAt;
        delete update.updatedAt;

        return update;
    }
}