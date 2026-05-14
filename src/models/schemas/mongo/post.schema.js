"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postMongoSchema = void 0;
exports.postMongoSchema = {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    authorId: { type: String, required: true, index: true },
    tags: { type: [String], default: [] },
    likesCount: { type: Number, default: 0, min: 0 },
};
//# sourceMappingURL=post.schema.js.map