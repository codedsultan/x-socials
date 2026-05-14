"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpRepository = void 0;
const BaseRepository_1 = require("./BaseRepository");
class OtpRepository extends BaseRepository_1.BaseRepository {
    async findValidOtp(userId, code, purpose) {
        return this.findOne({ userId, code, purpose, used: false });
    }
    async markUsed(id) {
        return this.update(id, { used: true });
    }
}
exports.OtpRepository = OtpRepository;
//# sourceMappingURL=OtpRepository.js.map