import type { SchemaDefinition } from 'mongoose';

export const postMongoSchema: SchemaDefinition = {
    title:    { type: String, required: true, trim: true },
    content:  { type: String, required: true },
    authorId: { type: String, required: true, index: true },
    tags:     { type: [String], default: [] },
    likesCount: { type: Number, default: 0, min: 0 },
};
