// migrations/20240101000001_create_otps.ts
import type { Knex } from 'knex';

/**
 * OTPs table.
 * OTPs are write-once — no updated_at column.
 * id is application-supplied UUID v7.
 */
export async function up(knex: Knex): Promise<void> {
    if (await knex.schema.hasTable('otps')) {
        console.log('Table otps already exists, skipping');
        return;
    }

    await knex.schema.createTable('otps', (table) => {
        table.string('id', 36).primary();
        table.string('user_id', 36).notNullable();
        table.string('code', 10).notNullable();
        table.string('purpose', 50).notNullable();
        table.boolean('used').notNullable().defaultTo(false);
        table.timestamp('expires_at').notNullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

        table.index('user_id', 'idx_otps_user_id');
        table.index(['user_id', 'purpose'], 'idx_otps_user_purpose');
        table.index('expires_at', 'idx_otps_expires_at');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('otps');
}
