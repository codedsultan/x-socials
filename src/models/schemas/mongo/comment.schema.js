"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentMongoSchema = void 0;
exports.commentMongoSchema = {
    postId: { type: String, required: true, index: true },
    authorId: { type: String, required: true, index: true },
    content: { type: String, required: true, trim: true },
    parentId: { type: String, default: null },
};
//# sourceMappingURL=comment.schema.js.map