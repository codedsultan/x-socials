import type { Knex } from 'knex';

export const otpsTable = {
    tableName: 'otps',
    up(table: Knex.CreateTableBuilder, db: Knex): void {
        table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
        table.uuid('user_id').notNullable();
        table.string('code', 10).notNullable();
        table.string('purpose', 50).notNullable();
        table.boolean('used').defaultTo(false);
        table.timestamp('expires_at').notNullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
    },
};
