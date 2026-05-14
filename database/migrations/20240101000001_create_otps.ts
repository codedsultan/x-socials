// migrations/20240101000001_create_otps.ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    // Check if table already exists
    const exists = await knex.schema.hasTable('otps');

    if (!exists) {
        await knex.schema.createTable('otps', (table) => {
            table.string('id', 36).primary();
            table.string('user_id', 36).notNullable();
            table.string('code', 10).notNullable();
            table.string('purpose', 50).notNullable();
            table.boolean('used').defaultTo(false);
            table.timestamp('expires_at').notNullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());

            table.index('user_id');
            table.index(['user_id', 'purpose']);
            table.index('code');
            table.index('expires_at');
        });
    } else {
        console.log('Table otps already exists, skipping creation');
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('otps');
}