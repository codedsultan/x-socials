"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LikeRepository = void 0;
const BaseRepository_1 = require("./BaseRepository");
class LikeRepository extends BaseRepository_1.BaseRepository {
    async hasUserLiked(userId, targetId, targetType) {
        return this.exists({ userId, targetId, targetType });
    }
    async findByTarget(targetId, targetType) {
        return this.findMany({ targetId, targetType });
    }
}
exports.LikeRepository = LikeRepository;
//# sourceMappingURL=LikeRepository.js.map