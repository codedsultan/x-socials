// migrations/20240101000002_create_tokens.ts
import type { Knex } from 'knex';

/**
 * Auth tokens (refresh tokens).
 *
 * Tokens are written once and either deleted (logout, rotation) or read
 * (validation). No updated_at needed.
 *
 * token — 512 chars: covers UUID-based refresh tokens (36 chars) and any
 * future opaque token format with plenty of headroom.
 */
export async function up(knex: Knex): Promise<void> {
    if (await knex.schema.hasTable('tokens')) {
        console.log('Table tokens already exists, skipping');
        return;
    }

    await knex.schema.createTable('tokens', (table) => {
        table.string('id', 36).primary();
        table.string('user_id', 36).notNullable();
        table.string('token', 512).notNullable().unique();
        table.string('type', 50).notNullable();
        table.timestamp('expires_at').notNullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

        table.index('user_id', 'idx_tokens_user_id');
        table.index('expires_at', 'idx_tokens_expires_at');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('tokens');
}
