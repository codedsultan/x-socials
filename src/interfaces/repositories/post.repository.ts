/**
 * @file src/interfaces/repositories/post.repository.ts
 * @description Database-agnostic post repository interface
 */

import type { IPost, PostStatus } from "../entities/post/core";

export interface IPostRepository {
    findById(id: string | number): Promise<IPost | null>;
    findByIds(ids: (string | number)[]): Promise<IPost[]>;
    findByUserId(userId: string | number): Promise<IPost[]>;
    findAll(options?: {
        limit?: number;
        offset?: number;
        status?: PostStatus;
        sortBy?: 'createdAt' | 'updatedAt' | 'likesCount';
        sortOrder?: 'asc' | 'desc';
    }): Promise<IPost[]>;
    create(postData: Omit<IPost, 'id' | 'createdAt' | 'updatedAt'>): Promise<IPost>;
    update(id: string | number, updates: Partial<Omit<IPost, 'id' | 'userId' | 'createdAt'>>): Promise<IPost | null>;
    delete(id: string | number): Promise<boolean>;
    softDelete(id: string | number): Promise<IPost | null>;
    count(filters?: Partial<Pick<IPost, 'userId' | 'status'>>): Promise<number>;
    updateStatus(id: string | number, status: PostStatus): Promise<IPost | null>;

    // Additional useful methods
    incrementMetadata(id: string | number, field: 'likesCount' | 'commentsCount' | 'sharesCount', increment: number): Promise<IPost | null>;
    exists(id: string | number): Promise<boolean>;
    getRecentByUser(userId: string | number, limit?: number): Promise<IPost[]>;
}