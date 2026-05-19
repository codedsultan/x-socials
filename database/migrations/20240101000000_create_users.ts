// migrations/20240101000000_create_users.ts
import type { Knex } from 'knex';

/**
 * Users table.
 *
 * id — VARCHAR(36), application-supplied UUID v7. No database default needed
 *      because KnexAdapter.create() always injects the id before INSERT.
 *      This is portable across PostgreSQL, MySQL, and SQLite.
 *
 * updated_at — maintained by the application (KnexAdapter.update() injects it).
 *              No trigger required, works on all three SQL engines.
 */
export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('users', (table) => {
        table.string('id', 36).primary();
        table.string('email', 255).notNullable().unique();
        table.string('password_hash', 255).notNullable();
        table.string('name', 255).nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

        table.index('email', 'idx_users_email');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('users');
}
