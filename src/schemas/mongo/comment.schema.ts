import type { SchemaDefinition } from 'mongoose';

export const commentMongoSchema: SchemaDefinition = {
    postId:         { type: String, required: true },
    authorId:       { type: String, required: true },
    content:        { type: String, required: true, trim: true },
    parentId:       { type: String, default: null },
    // Soft-delete — same pattern as posts.
    deletedAt:      { type: Date, default: null },
    deletionReason: { type: String, default: null },  // 'admin_removed' | 'author_deleted'
};

/**
 * Schema-level indexes for comments.
 *
 *  idx_comments_post    — covers listForPost(postId) — the most frequent read.
 *  idx_comments_author  — covers "all comments by user" queries.
 *  idx_comments_parent  — covers findReplies(parentId) — without this, nested
 *                         comment threads degrade to a full collection scan.
 */
export const commentSchemaIndexes = [
    {
        fields: { postId: 1, createdAt: -1 },
        options: { name: 'idx_comments_post' },
    },
    {
        fields: { authorId: 1 },
        options: { name: 'idx_comments_author' },
    },
    {
        fields: { parentId: 1 },
        options: { sparse: true, name: 'idx_comments_parent' },
    },
] as const;
