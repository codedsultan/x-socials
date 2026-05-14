"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenRepository = void 0;
const BaseRepository_1 = require("./BaseRepository");
class TokenRepository extends BaseRepository_1.BaseRepository {
    async findByValue(token) {
        return this.findOne({ token });
    }
    async revokeAllForUser(userId) {
        const tokens = await this.findMany({ userId });
        await Promise.all(tokens.map(t => this.delete(t.id)));
    }
}
exports.TokenRepository = TokenRepository;
//# sourceMappingURL=TokenRepository.js.map