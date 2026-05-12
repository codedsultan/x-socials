/**
 * @file src/interfaces/entities/user/sql.ts
 * @description SQL-specific user interfaces (Knex)
 */

import type { IUser } from './core';

export interface IUserSQLRow extends IUser {
    id: number;  // Override as number
    created_at: Date;
    updated_at: Date;
    apikey?: string | null;
    banned: boolean;
    banned_by_id?: number | null;
    verification_token?: string | null;
    verification_expires?: Date | null;
    reset_password_token?: string | null;
    reset_password_expires?: Date | null;
    change_email_token?: string | null;
    change_email_expires?: Date | null;
    change_email_address?: string | null;
}

export type IUserSQLInsert = Omit<IUserSQLRow, "id" | "created_at" | "updated_at">;
export type IUserSQLUpdate = Partial<IUserSQLInsert>;