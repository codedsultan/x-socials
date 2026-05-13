import type { SchemaDefinition } from 'mongoose';

export const commentMongoSchema: SchemaDefinition = {
    postId:   { type: String, required: true, index: true },
    authorId: { type: String, required: true, index: true },
    content:  { type: String, required: true, trim: true },
    parentId: { type: String, default: null },
};
