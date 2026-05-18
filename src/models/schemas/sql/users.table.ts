import type { Knex } from 'knex';

/**
 * Users table schema (used by KnexAdapter._devMigrate in test mode).
 *
 * IDs are VARCHAR(36) — the application always supplies a UUID v7 via
 * KnexAdapter.create(), so no database-level default is needed or used.
 * This keeps the schema portable across PostgreSQL, MySQL, and SQLite.
 */
export const usersTable = {
    tableName: 'users',
    up(table: Knex.CreateTableBuilder, db: Knex): void {
        table.string('id', 36).primary();
        table.string('email', 255).notNullable().unique();
        table.string('password_hash', 255).notNullable();
        table.string('name', 255).nullable();
        table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());

        table.index('email', 'idx_users_email');
    },
};
