import type { Knex } from 'knex';

/**
 * Follows table schema (used by KnexAdapter._devMigrate in test mode).
 * Mirrors database/migrations/20240101000003_create_follows.ts exactly.
 *
 * Composite PK (follower_id, following_id) enforces uniqueness without
 * a separate unique index. No surrogate id — follows have no mutable state.
 */
export const followsTable = {
    tableName: 'follows',
    up(table: Knex.CreateTableBuilder, _db: Knex): void {
        table.string('follower_id', 36).notNullable();
        table.string('following_id', 36).notNullable();
        table.primary(['follower_id', 'following_id']);
        table.timestamp('created_at').notNullable().defaultTo(_db.fn.now());

        table.index('following_id', 'idx_follows_following_id');
    },
};
