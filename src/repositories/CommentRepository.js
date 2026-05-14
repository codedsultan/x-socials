"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentRepository = void 0;
const BaseRepository_1 = require("./BaseRepository");
class CommentRepository extends BaseRepository_1.BaseRepository {
    async findByPost(postId, options) {
        return this.findMany({ postId }, options);
    }
    async findReplies(parentId, options) {
        return this.findMany({ parentId }, options);
    }
}
exports.CommentRepository = CommentRepository;
//# sourceMappingURL=CommentRepository.js.map