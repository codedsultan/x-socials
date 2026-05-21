import type { Knex } from 'knex';

/**
 * Auth tokens (refresh tokens).
 * token column is 512 chars — enough for any JWT or UUID-based token.
 * IDs are application-supplied UUID v7 (no database default).
 */
export const tokensTable = {
    tableName: 'tokens',
    up(table: Knex.CreateTableBuilder, db: Knex): void {
        table.string('id', 36).primary();
        table.string('user_id', 36).notNullable();
        table.string('token', 512).notNullable().unique();
        table.string('type', 50).notNullable();
        table.timestamp('expires_at').notNullable();
        table.timestamp('created_at').notNullable().defaultTo(db.fn.now());

        table.index('user_id', 'idx_tokens_user_id');
        table.index('expires_at', 'idx_tokens_expires_at');
    },
};
