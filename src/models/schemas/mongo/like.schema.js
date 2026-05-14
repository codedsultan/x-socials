"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.likeMongoSchema = void 0;
exports.likeMongoSchema = {
    targetId: { type: String, required: true, index: true },
    targetType: { type: String, required: true, enum: ['post', 'comment'] },
    userId: { type: String, required: true, index: true },
};
//# sourceMappingURL=like.schema.js.map