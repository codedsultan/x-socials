import type { Knex } from 'knex';

/**
 * OTPs are write-once — no updated_at column needed.
 * IDs are application-supplied UUID v7 (no database default).
 */
export const otpsTable = {
    tableName: 'otps',
    up(table: Knex.CreateTableBuilder, db: Knex): void {
        table.string('id', 36).primary();
        table.string('user_id', 36).notNullable();
        table.string('code', 10).notNullable();
        table.string('purpose', 50).notNullable();
        table.boolean('used').notNullable().defaultTo(false);
        table.timestamp('expires_at').notNullable();
        table.timestamp('created_at').notNullable().defaultTo(db.fn.now());

        table.index('user_id', 'idx_otps_user_id');
        table.index(['user_id', 'purpose'], 'idx_otps_user_purpose');
        table.index('expires_at', 'idx_otps_expires_at');
    },
};
