import type { SchemaDefinition } from 'mongoose';

export const likeMongoSchema: SchemaDefinition = {
    targetId:   { type: String, required: true, index: true },
    targetType: { type: String, required: true, enum: ['post', 'comment'] },
    userId:     { type: String, required: true, index: true },
};
