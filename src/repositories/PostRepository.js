"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostRepository = void 0;
const BaseRepository_1 = require("./BaseRepository");
class PostRepository extends BaseRepository_1.BaseRepository {
    /** Find all posts by a given author */
    async findByAuthor(authorId, options) {
        return this.findMany({ authorId }, options);
    }
    /**
     * Find posts that include ALL of the given tags.
     * Uses findMany with a plain equality filter —
     * each adapter translates this without DB-specific operators leaking here.
     */
    async findByTag(tag, options) {
        return this.findMany({ tags: [tag] }, options);
    }
    /**
     * Increment the likes counter atomically.
     * Delegates the DB-specific increment to the adapter via update().
     * For Mongo this uses $inc through a raw update; for SQL this is a
     * safe increment using a subquery — the adapter handles the translation.
     */
    async incrementLikes(postId) {
        // We surface a clean domain method. The adapter's update()
        // for Mongo will accept $inc; for Knex we use a raw expression.
        return this.adapter.update(this.modelName, postId, { $inc: { likesCount: 1 } });
    }
}
exports.PostRepository = PostRepository;
//# sourceMappingURL=PostRepository.js.map