import type { SchemaDefinition } from 'mongoose';

export const likeMongoSchema: SchemaDefinition = {
    targetId:   { type: String, required: true },
    targetType: { type: String, required: true, enum: ['post', 'comment'] },
    userId:     { type: String, required: true },
};

/**
 * Schema-level index options passed to MongooseAdapter.registerModel().
 *
 * Compound unique index on (userId, targetId, targetType):
 *   - Enforces at the database level that a user can only like a target once.
 *   - Also serves as the covering index for the hasUserLiked() query
 *     (findOne({ userId, targetId, targetType })), making it a single index
 *     scan instead of three separate single-field index lookups.
 *   - sparse: false — all three fields are required, so no sparse needed.
 *
 * Secondary index on targetId for "count likes on a post/comment" queries.
 */
export const likeSchemaIndexes = [
    {
        fields: { userId: 1, targetId: 1, targetType: 1 },
        options: { unique: true, name: 'idx_likes_user_target_unique' },
    },
    {
        fields: { targetId: 1, targetType: 1 },
        options: { name: 'idx_likes_target' },
    },
] as const;
