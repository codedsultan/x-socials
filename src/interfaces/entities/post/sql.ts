/**
 * @file src/interfaces/entities/post/sql.ts
 * @description SQL-specific post interfaces (Knex)
 */

import type { IPost, PostStatus } from './core';

export interface IPostSQLRow extends IPost {
    id: number;  // Override as number for SQL
    user_id: number;  // SQL naming convention (snake_case)
    content: string;
    media_urls?: string[] | null;  // SQL naming convention
    status: PostStatus;
    created_at: Date;  // SQL naming convention
    updated_at: Date;  // SQL naming convention

    // Additional SQL-specific fields
    deleted_at?: Date | null;
    pinned?: boolean;
    edited_at?: Date | null;
    edit_count?: number;
}

export type IPostSQLInsert = Omit<IPostSQLRow, "id" | "created_at" | "updated_at">;
export type IPostSQLUpdate = Partial<IPostSQLInsert>;