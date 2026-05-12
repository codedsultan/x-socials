/**
 * @file src/models/sql/post.model.ts
 * @description SQL/Knex model for Posts
 */

import type { Knex } from "knex";
import type { IPostSQLRow, IPostSQLInsert, IPostSQLUpdate } from "../../interfaces/entities/post/sql";

export const POST_TABLE = "posts";

export class PostSQLModel {
    constructor(private knex: Knex) { }

    get table() {
        return this.knex(POST_TABLE);
    }

    async findAll(options?: { limit?: number; offset?: number; status?: string }): Promise<IPostSQLRow[]> {
        let query = this.table.select("*").whereNull("deleted_at");

        if (options?.status) {
            query = query.where({ status: options.status });
        }
        if (options?.limit) query = query.limit(options.limit);
        if (options?.offset) query = query.offset(options.offset);

        return query.orderBy("created_at", "desc");
    }

    async findById(id: number): Promise<IPostSQLRow | undefined> {
        return this.table.where({ id }).whereNull("deleted_at").first();
    }

    async findByUserId(userId: number): Promise<IPostSQLRow[]> {
        return this.table
            .where({ user_id: userId })
            .whereNull("deleted_at")
            .orderBy("created_at", "desc");
    }

    async create(data: IPostSQLInsert): Promise<IPostSQLRow> {
        const [post] = await this.table.insert(data).returning("*");
        return post;
    }

    async update(id: number, data: IPostSQLUpdate): Promise<IPostSQLRow | undefined> {
        const [post] = await this.table
            .where({ id })
            .whereNull("deleted_at")
            .update({ ...data, updated_at: new Date() })
            .returning("*");
        return post;
    }

    async softDelete(id: number): Promise<IPostSQLRow | undefined> {
        const [post] = await this.table
            .where({ id })
            .whereNull("deleted_at")
            .update({
                status: "deleted",
                deleted_at: new Date(),
                updated_at: new Date()
            })
            .returning("*");
        return post;
    }

    async delete(id: number): Promise<boolean> {
        const deleted = await this.table.where({ id }).delete();
        return deleted > 0;
    }

    async incrementMetadata(id: number, field: "likesCount" | "commentsCount" | "sharesCount", increment: number): Promise<IPostSQLRow | undefined> {
        // PostgreSQL JSONB update
        const [post] = await this.table
            .where({ id })
            .whereNull("deleted_at")
            .update({
                metadata: this.knex.raw(`
                    jsonb_set(
                        COALESCE(metadata, '{"likesCount": 0, "commentsCount": 0, "sharesCount": 0}'::jsonb),
                        '{${field}}',
                        (COALESCE((metadata->>'${field}')::int, 0) + ${increment})::text::jsonb
                    )
                `),
                updated_at: new Date()
            })
            .returning("*");
        return post;
    }

    async count(filters?: Partial<IPostSQLRow>): Promise<number> {
        let query = this.table.count("id as count").whereNull("deleted_at");
        if (filters) {
            query = query.where(filters);
        }
        const result = await query.first();
        return parseInt((result?.count as string) || "0", 10);
    }
}