/**
 * ModelSchemas registry.
 *
 * Each entry maps a model name to its adapter-specific schema fragment.
 * Adapters consume:
 *   - entry.sql   → KnexAdapter  (tableName + up migration fn)
 *   - entry.mongo → MongooseAdapter (SchemaDefinition)
 *   - entry.mongoIndexes → MongooseAdapter (applied via schema.index() after creation)
 *
 * Keeping SQL and Mongo concerns here — isolated from business logic — means
 * a schema change is a single-file edit with a clear blast radius.
 */

import type { Knex } from 'knex';
import { usersTable }         from './sql/users.table';
import { otpsTable }          from './sql/otps.table';
import { tokensTable }        from './sql/tokens.table';
import { followsTable }       from './sql/follows.table';
import { notificationsTable } from './sql/notifications.table';
import { postMongoSchema, postSchemaIndexes }       from './mongo/post.schema';
import { commentMongoSchema, commentSchemaIndexes } from './mongo/comment.schema';
import { likeMongoSchema, likeSchemaIndexes }       from './mongo/like.schema';

export interface MongoIndexDef {
    fields: Record<string, 1 | -1>;
    options?: {
        unique?: boolean;
        sparse?: boolean;
        name?: string;
    };
}

export interface ModelSchemaEntry {
    sql?: {
        tableName: string;
        up: (table: Knex.CreateTableBuilder, db: Knex) => void;
    };
    mongo?: Record<string, unknown>;
    /** Compound/additional indexes applied after Mongoose schema creation. */
    mongoIndexes?: ReadonlyArray<MongoIndexDef>;
}

export const ModelSchemas: Record<string, ModelSchemaEntry> = {
    User:         { sql: usersTable },
    Otp:          { sql: otpsTable },
    Token:        { sql: tokensTable },
    Follow:       { sql: followsTable },
    Notification: { sql: notificationsTable },
    Post:         { mongo: postMongoSchema,    mongoIndexes: postSchemaIndexes },
    Comment:      { mongo: commentMongoSchema, mongoIndexes: commentSchemaIndexes },
    Like:         { mongo: likeMongoSchema,    mongoIndexes: likeSchemaIndexes },
};
