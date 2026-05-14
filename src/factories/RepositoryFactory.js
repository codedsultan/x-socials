"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepositoryFactory = void 0;
const BaseRepository_1 = require("../repositories/BaseRepository");
const PostRepository_1 = require("../repositories/PostRepository");
const CommentRepository_1 = require("../repositories/CommentRepository");
const LikeRepository_1 = require("../repositories/LikeRepository");
const UserRepository_1 = require("../repositories/UserRepository");
const OtpRepository_1 = require("../repositories/OtpRepository");
const TokenRepository_1 = require("../repositories/TokenRepository");
/**
 * RepositoryFactory builds and caches repository instances.
 *
 * It is a plain class — no static getInstance(), no global state.
 * Construct once in the composition root and inject wherever needed.
 * Model schemas are registered by DbResolver before this is constructed.
 */
class RepositoryFactory {
    resolver;
    cache = new Map();
    constructor(resolver) {
        this.resolver = resolver;
    }
    getRepository(modelName) {
        if (this.cache.has(modelName)) {
            return this.cache.get(modelName);
        }
        const adapter = this.resolver.getAdapterForModel(modelName);
        let repo;
        switch (modelName) {
            case 'Post':
                repo = new PostRepository_1.PostRepository(adapter, modelName);
                break;
            case 'Comment':
                repo = new CommentRepository_1.CommentRepository(adapter, modelName);
                break;
            case 'Like':
                repo = new LikeRepository_1.LikeRepository(adapter, modelName);
                break;
            case 'User':
                repo = new UserRepository_1.UserRepository(adapter, modelName);
                break;
            case 'Otp':
                repo = new OtpRepository_1.OtpRepository(adapter, modelName);
                break;
            case 'Token':
                repo = new TokenRepository_1.TokenRepository(adapter, modelName);
                break;
            default:
                repo = new BaseRepository_1.BaseRepository(adapter, modelName);
        }
        this.cache.set(modelName, repo);
        return repo;
    }
}
exports.RepositoryFactory = RepositoryFactory;
//# sourceMappingURL=RepositoryFactory.js.map