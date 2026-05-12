/**
 * @file src/interfaces/entities/post/guards.ts
 * @description Type guards and helper functions for Post entities
 */

import type { IPost } from './core';
import type { IPostMongoDocument } from './mongo';
import type { IPostSQLRow } from './sql';

export function isPostMongoDocument(post: any): post is IPostMongoDocument {
    return post && '_id' in post && typeof post._id?.toHexString === 'function';
}

export function isPostSQLRow(post: any): post is IPostSQLRow {
    return post && 'id' in post && typeof post.id === 'number';
}

export function toCorePost(post: IPostMongoDocument | IPostSQLRow): IPost {
    if (isPostMongoDocument(post)) {
        return {
            id: post.id,
            userId: post.userId.toString(),
            content: post.content,
            mediaUrls: post.mediaUrls,
            status: post.status,
            metadata: post.metadata,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt
        };
    } else {
        return {
            id: post.id,
            userId: post.user_id,
            content: post.content,
            mediaUrls: post.media_urls || undefined,
            status: post.status,
            metadata: post.metadata,
            createdAt: post.created_at,
            updatedAt: post.updated_at
        };
    }
}