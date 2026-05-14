"use strict";
/**
 * ModelSchemas registry.
 *
 * Each entry maps a model name to its adapter-specific schema fragment.
 * The adapters know which key to look at:
 *   - KnexAdapter  → entry.sql   (tableName + up fn)
 *   - MongooseAdapter → entry.mongo (SchemaDefinition)
 *
 * This keeps SQL and Mongo concerns isolated while letting DbResolver
 * call registerModel(name, entry) uniformly.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelSchemas = void 0;
const users_table_1 = require("./sql/users.table");
const otps_table_1 = require("./sql/otps.table");
const tokens_table_1 = require("./sql/tokens.table");
const post_schema_1 = require("./mongo/post.schema");
const comment_schema_1 = require("./mongo/comment.schema");
const like_schema_1 = require("./mongo/like.schema");
exports.ModelSchemas = {
    User: { sql: users_table_1.usersTable },
    Otp: { sql: otps_table_1.otpsTable },
    Token: { sql: tokens_table_1.tokensTable },
    Post: { mongo: post_schema_1.postMongoSchema },
    Comment: { mongo: comment_schema_1.commentMongoSchema },
    Like: { mongo: like_schema_1.likeMongoSchema },
};
//# sourceMappingURL=index.js.map