// migrations/20240101000005_add_suspended_to_users.ts
import type { Knex } from 'knex';

/**
 * Add suspended column to users.
 *
 * suspended = true  →  user cannot log in, existing tokens are rejected
 *                       immediately by the authenticate middleware.
 * suspended = false →  normal user (default).
 *
 * Non-destructive additive migration — safe against populated tables.
 */
export async function up(knex: Knex): Promise<void> {
    const hasCol = await knex.schema.hasColumn('users', 'suspended');
    if (!hasCol) {
        await knex.schema.alterTable('users', (table) => {
            table.boolean('suspended')
                .notNullable()
                .defaultTo(false)
                .after('name');
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('users', (table) => {
        table.dropColumn('suspended');
    });
}
