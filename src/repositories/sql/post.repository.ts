/**
 * @file src/repositories/sql/post.repository.ts
 * @description SQL (PostgreSQL) implementation for Posts using your DbManager
 */

import DbManager from "../../config/db/DbManager";
import { KnexAdapter } from "../../config/db/adapters/KnexAdapter";
import type { IPostRepository } from "../../interfaces/repositories/post.repository";
import type { IPost, PostStatus } from "../../interfaces/entities/post/core";
import type { IPostSQLRow, IPostSQLInsert, IPostSQLUpdate } from "../../interfaces/entities/post/sql";
import type { Knex } from "knex";

export class SQLPostRepository implements IPostRepository {
    private get adapter(): KnexAdapter {
        const adapter = DbManager.getInstance().resolveForModel("PostModel");

        if (!adapter) {
            throw new Error("PostModel not bound to any connection. Call DbManager.bindModel() first.");
        }

        if (!(adapter instanceof KnexAdapter)) {
            throw new Error("PostModel is not bound to a SQL/Knex connection");
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
        return "posts";
    }

    async findById(id: string | number): Promise<IPost | null> {
        const postId = typeof id === 'string' ? parseInt(id, 10) : id;
        const post = await this.knex(this.tableName)
            .where({ id: postId, deleted_at: null })
            .first();
        return post ? this.toCorePost(post) : null;
    }

    async findByIds(ids: (string | number)[]): Promise<IPost[]> {
        const numericIds = ids.map(id => typeof id === 'string' ? parseInt(id, 10) : id);
        const posts = await this.knex(this.tableName)
            .whereIn('id', numericIds)
            .where({ deleted_at: null })
            .orderBy('created_at', 'desc');
        return posts.map((post) => this.toCorePost(post));
    }

    async findByUserId(userId: string | number): Promise<IPost[]> {
        const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
        const posts = await this.knex(this.tableName)
            .where({ user_id: userIdNum, deleted_at: null })
            .orderBy('created_at', 'desc');
        return posts.map((post) => this.toCorePost(post));
    }

    async findAll(options?: { limit?: number; offset?: number; status?: string }): Promise<IPost[]> {
        let query = this.knex(this.tableName)
            .where({ deleted_at: null });

        if (options?.status) {
            query = query.where({ status: options.status });
        }

        if (options?.limit) query = query.limit(options.limit);
        if (options?.offset) query = query.offset(options.offset);

        query = query.orderBy('created_at', 'desc');

        const posts = await query;
        return posts.map((post) => this.toCorePost(post));
    }

    async create(postData: Partial<IPost>): Promise<IPost> {
        const [post] = await this.knex(this.tableName)
            .insert(this.toSQLInsert(postData))
            .returning("*");
        return this.toCorePost(post);
    }

    async update(id: string | number, updates: Partial<IPost>): Promise<IPost | null> {
        const postId = typeof id === 'string' ? parseInt(id, 10) : id;
        const [post] = await this.knex(this.tableName)
            .where({ id: postId, deleted_at: null })
            .update({
                ...this.toSQLUpdate(updates),
                updated_at: new Date()
            })
            .returning("*");
        return post ? this.toCorePost(post) : null;
    }

    async delete(id: string | number): Promise<boolean> {
        const postId = typeof id === 'string' ? parseInt(id, 10) : id;
        const deleted = await this.knex(this.tableName)
            .where({ id: postId })
            .delete();
        return deleted > 0;
    }

    async count(filters?: Partial<IPost>): Promise<number> {
        let query = this.knex(this.tableName).count("id as count").where({ deleted_at: null });

        if (filters) {
            const sqlFilters: any = {};

            for (const [key, value] of Object.entries(filters)) {
                if (value === undefined || value === null) continue;

                if (key === 'id') continue;

                if (key === 'userId') {
                    sqlFilters.user_id = value;
                } else if (key === 'createdAt') {
                    sqlFilters.created_at = value;
                } else if (key === 'updatedAt') {
                    sqlFilters.updated_at = value;
                } else if (key === 'mediaUrls') {
                    continue;
                } else if (key === 'metadata') {
                    continue;
                } else {
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

    async updateStatus(id: string | number, status: PostStatus): Promise<IPost | null> {
        const postId = typeof id === 'string' ? parseInt(id, 10) : id;
        const [post] = await this.knex(this.tableName)
            .where({ id: postId, deleted_at: null })
            .update({
                status,
                updated_at: new Date(),
                ...(status === 'deleted' ? { deleted_at: new Date() } : {})
            })
            .returning("*");
        return post ? this.toCorePost(post) : null;
    }

    async softDelete(id: string | number): Promise<IPost | null> {
        const postId = typeof id === 'string' ? parseInt(id, 10) : id;
        const [post] = await this.knex(this.tableName)
            .where({ id: postId, deleted_at: null })
            .update({
                status: 'deleted',
                deleted_at: new Date(),
                updated_at: new Date()
            })
            .returning("*");
        return post ? this.toCorePost(post) : null;
    }

    async incrementMetadata(id: string | number, field: 'likesCount' | 'commentsCount' | 'sharesCount', increment: number): Promise<IPost | null> {
        const postId = typeof id === 'string' ? parseInt(id, 10) : id;

        // For PostgreSQL JSONB
        const [post] = await this.knex(this.tableName)
            .where({ id: postId, deleted_at: null })
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

        return post ? this.toCorePost(post) : null;
    }

    async exists(id: string | number): Promise<boolean> {
        const postId = typeof id === 'string' ? parseInt(id, 10) : id;
        const result = await this.knex(this.tableName)
            .where({ id: postId, deleted_at: null })
            .first('id');
        return !!result;
    }

    async getRecentByUser(userId: string | number, limit: number = 10): Promise<IPost[]> {
        const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
        const posts = await this.knex(this.tableName)
            .where({ user_id: userIdNum, deleted_at: null })
            .orderBy('created_at', 'desc')
            .limit(limit);
        return posts.map((post) => this.toCorePost(post));
    }

    private toCorePost(sqlPost: IPostSQLRow): IPost {
        let metadata = sqlPost.metadata;
        if (typeof metadata === 'string') {
            metadata = JSON.parse(metadata);
        }

        return {
            id: sqlPost.id.toString(),
            userId: sqlPost.user_id.toString(),
            content: sqlPost.content,
            mediaUrls: sqlPost.media_urls || [],
            status: sqlPost.status,
            metadata: {
                likesCount: metadata?.likesCount || 0,
                commentsCount: metadata?.commentsCount || 0,
                sharesCount: metadata?.sharesCount || 0
            },
            createdAt: sqlPost.created_at,
            updatedAt: sqlPost.updated_at
        };
    }

    private toSQLInsert(post: Partial<IPost>): IPostSQLInsert {
        const insert: any = {};

        if (post.userId) insert.user_id = post.userId;
        if (post.content) insert.content = post.content;
        if (post.mediaUrls) insert.media_urls = post.mediaUrls;
        if (post.status) insert.status = post.status;
        if (post.createdAt) insert.created_at = post.createdAt;
        if (post.updatedAt) insert.updated_at = post.updatedAt;

        if (post.metadata) {
            insert.metadata = JSON.stringify(post.metadata);
        }

        return insert as IPostSQLInsert;
    }

    private toSQLUpdate(updates: Partial<IPost>): Partial<IPostSQLUpdate> {
        const update: any = {};

        if (updates.userId) update.user_id = updates.userId;
        if (updates.content) update.content = updates.content;
        if (updates.mediaUrls) update.media_urls = updates.mediaUrls;
        if (updates.status) update.status = updates.status;

        if (updates.metadata) {
            update.metadata = JSON.stringify(updates.metadata);
        }

        return update;
    }
}