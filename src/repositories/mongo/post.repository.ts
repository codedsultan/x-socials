/**
 * @file src/repositories/mongo/post.repository.ts
 * @description MongoDB implementation for Posts using your DbManager
 */

import DbManager from "../../config/db/DbManager";
import type { MongooseAdapter } from "../../config/db/adapters/MongooseAdapter";
import type { IPostRepository } from "../../interfaces/repositories/post.repository";
import type { IPost, PostStatus } from "../../interfaces/entities/post/core";

export class MongoPostRepository implements IPostRepository {
    private get adapter(): MongooseAdapter {
        const adapter = DbManager.getInstance().resolveForModel("PostModel");

        if (!adapter) {
            throw new Error("PostModel not bound to any connection. Call DbManager.bindModel() first.");
        }

        return adapter as MongooseAdapter;
    }

    private get connection() {
        const client = this.adapter.getClient();

        if (!client) {
            throw new Error("Mongoose connection not initialized. Check your database connection.");
        }

        return client;
    }

    private get PostModel() {
        return this.connection.model("Post");
    }

    async findById(id: string): Promise<IPost | null> {
        const post = await this.PostModel.findById(id).lean();
        if (!post) return null;
        return this.toCorePost(post);
    }

    async findByIds(ids: (string | number)[]): Promise<IPost[]> {
        const stringIds = ids.map(id => id.toString());
        const posts = await this.PostModel.find({ _id: { $in: stringIds } }).lean();
        return posts.map((post) => this.toCorePost(post));
    }

    async findByUserId(userId: string): Promise<IPost[]> {
        const posts = await this.PostModel.find({ userId }).lean();
        return posts.map((post) => this.toCorePost(post));
    }

    async findAll(options?: { limit?: number; offset?: number; status?: string }): Promise<IPost[]> {
        let query = this.PostModel.find();

        if (options?.status) {
            query = query.where({ status: options.status });
        }

        if (options?.limit) query = query.limit(options.limit);
        if (options?.offset) query = query.skip(options.offset);

        query = query.sort({ createdAt: -1 });

        const posts = await query.lean();
        return posts.map((post) => this.toCorePost(post));
    }

    async create(postData: Partial<IPost>): Promise<IPost> {
        const post = await this.PostModel.create(postData);
        const postObject = post.toObject();
        return this.toCorePost(postObject);
    }

    async update(id: string, updates: Partial<IPost>): Promise<IPost | null> {
        const post = await this.PostModel.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, lean: true }
        );
        if (!post) return null;
        return this.toCorePost(post);
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.PostModel.findByIdAndDelete(id);
        return !!result;
    }

    async count(filters?: Partial<IPost>): Promise<number> {
        const mongoFilters: Record<string, any> = {};

        if (filters) {
            for (const [key, value] of Object.entries(filters)) {
                if (value !== undefined && value !== null) {
                    mongoFilters[key] = value;
                }
            }
        }

        return this.PostModel.countDocuments(mongoFilters);
    }

    async updateStatus(id: string, status: PostStatus): Promise<IPost | null> {
        const post = await this.PostModel.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true, lean: true }
        );
        if (!post) return null;
        return this.toCorePost(post);
    }

    async softDelete(id: string): Promise<IPost | null> {
        return this.updateStatus(id, "deleted");
    }

    async incrementMetadata(id: string, field: 'likesCount' | 'commentsCount' | 'sharesCount', increment: number): Promise<IPost | null> {
        const post = await this.PostModel.findByIdAndUpdate(
            id,
            { $inc: { [`metadata.${field}`]: increment } },
            { new: true, lean: true }
        );
        if (!post) return null;
        return this.toCorePost(post);
    }

    async exists(id: string): Promise<boolean> {
        const count = await this.PostModel.countDocuments({ _id: id });
        return count > 0;
    }

    async getRecentByUser(userId: string, limit: number = 10): Promise<IPost[]> {
        const posts = await this.PostModel.find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        return posts.map((post) => this.toCorePost(post));
    }

    private toCorePost(mongoPost: any): IPost {
        return {
            id: mongoPost._id.toString(),
            userId: mongoPost.userId.toString(),
            content: mongoPost.content,
            mediaUrls: mongoPost.mediaUrls || [],
            status: mongoPost.status,
            metadata: {
                likesCount: mongoPost.metadata?.likesCount || 0,
                commentsCount: mongoPost.metadata?.commentsCount || 0,
                sharesCount: mongoPost.metadata?.sharesCount || 0
            },
            createdAt: mongoPost.createdAt,
            updatedAt: mongoPost.updatedAt
        };
    }
}