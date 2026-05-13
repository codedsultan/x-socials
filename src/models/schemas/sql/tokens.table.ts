import type { Knex } from 'knex';

export const tokensTable = {
    tableName: 'tokens',
    up(table: Knex.CreateTableBuilder, db: Knex): void {
        table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
        table.uuid('user_id').notNullable();
        table.text('token').notNullable().unique();
        table.string('type', 50).notNullable();
        table.timestamp('expires_at').notNullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
    },
};
