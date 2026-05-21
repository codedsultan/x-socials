import type { SchemaDefinition } from 'mongoose';

export const postMongoSchema: SchemaDefinition = {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    authorId: { type: String, required: true },
    tags: { type: [String], default: [] },
    likesCount: { type: Number, default: 0, min: 0 },
    deletedAt: { type: Date, default: null },
    deletionReason: { type: String, default: null },  // 'admin_removed' | 'author_deleted'
};

/**
 * Schema-level indexes for posts.
 *
 *  idx_posts_author   — covers findByAuthor() and user feed queries.
 *  idx_posts_created  — covers home feed (newest first) — all posts sorted by time.
 *  idx_posts_tags     — covers findByTag() — multikey index on the tags array.
 */
export const postSchemaIndexes = [
    {
        fields: { authorId: 1, createdAt: -1 },
        options: { name: 'idx_posts_author' },
    },
    {
        fields: { createdAt: -1 },
        options: { name: 'idx_posts_created' },
    },
    {
        fields: { tags: 1 },
        options: { name: 'idx_posts_tags' },
    },
    {
        fields: { createdAt: 1, deletedAt: 1 },
        options: { name: 'idx_posts_created_at_deleted_at' },
    },
] as const;
