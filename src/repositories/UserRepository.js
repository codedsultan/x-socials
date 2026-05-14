"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const BaseRepository_1 = require("./BaseRepository");
class UserRepository extends BaseRepository_1.BaseRepository {
    async findByEmail(email) {
        return this.findOne({ email });
    }
    async emailExists(email) {
        return this.exists({ email });
    }
}
exports.UserRepository = UserRepository;
//# sourceMappingURL=UserRepository.js.map