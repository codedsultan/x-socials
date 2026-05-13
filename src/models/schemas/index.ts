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

import type { Knex } from 'knex';
import { usersTable }   from './sql/users.table';
import { otpsTable }    from './sql/otps.table';
import { tokensTable }  from './sql/tokens.table';
import { postMongoSchema }    from './mongo/post.schema';
import { commentMongoSchema } from './mongo/comment.schema';
import { likeMongoSchema }    from './mongo/like.schema';

export interface ModelSchemaEntry {
    sql?: {
        tableName: string;
        up: (table: Knex.CreateTableBuilder, db: Knex) => void;
    };
    mongo?: Record<string, unknown>;
}

export const ModelSchemas: Record<string, ModelSchemaEntry> = {
    User:    { sql: usersTable },
    Otp:     { sql: otpsTable },
    Token:   { sql: tokensTable },
    Post:    { mongo: postMongoSchema },
    Comment: { mongo: commentMongoSchema },
    Like:    { mongo: likeMongoSchema },
};
