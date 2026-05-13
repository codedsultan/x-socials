import type { Knex } from 'knex';

export const usersTable = {
    tableName: 'users',
    up(table: Knex.CreateTableBuilder, db: Knex): void {
        table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
        table.string('email', 255).unique().notNullable();
        table.string('password_hash', 255).notNullable();
        table.string('name', 255).nullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
    },
};
