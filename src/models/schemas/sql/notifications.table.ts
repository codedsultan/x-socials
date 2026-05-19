import type { Knex } from 'knex';

export const notificationsTable = {
    tableName: 'notifications',
    up(table: Knex.CreateTableBuilder, db: Knex): void {
        table.string('id', 36).primary();
        table.string('recipient_id', 36).notNullable();
        table.string('actor_id', 36).notNullable();
        table.string('type', 50).notNullable();
        table.string('reference_id', 255).nullable();
        table.boolean('read').notNullable().defaultTo(false);
        table.timestamp('created_at').notNullable().defaultTo(db.fn.now());

        table.index(['recipient_id', 'read', 'id'], 'idx_notifications_recipient_read');
        table.index('recipient_id', 'idx_notifications_recipient');
    },
};
