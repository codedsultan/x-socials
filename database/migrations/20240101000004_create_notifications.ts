// migrations/20240101000004_create_notifications.ts
import type { Knex } from 'knex';

/**
 * Notifications table.
 *
 * Design:
 *   - `actor_id`     — the user who triggered the event (liked, followed, commented)
 *   - `recipient_id` — the user who receives the notification
 *   - `type`         — 'like_post' | 'like_comment' | 'follow' | 'comment' | 'reply'
 *   - `reference_id` — ID of the relevant entity (post, comment, follow row)
 *   - `read`         — false until the recipient views the notification
 *
 * Keyset-paginated via the `id` primary key (UUID v7 = time-ordered).
 * Composite index (recipient_id, read, id DESC) covers the most common query:
 * "unread notifications for user X, newest first".
 */
export async function up(knex: Knex): Promise<void> {
    if (await knex.schema.hasTable('notifications')) return;

    await knex.schema.createTable('notifications', (table) => {
        table.string('id', 36).primary();
        table.string('recipient_id', 36).notNullable();
        table.string('actor_id', 36).notNullable();
        table.string('type', 50).notNullable();
        table.string('reference_id', 255).nullable();
        table.boolean('read').notNullable().defaultTo(false);
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

        table.foreign('recipient_id').references('id').inTable('users').onDelete('CASCADE');
        table.foreign('actor_id').references('id').inTable('users').onDelete('CASCADE');

        // Primary read query: unread notifications for a user, newest first
        table.index(['recipient_id', 'read', 'id'], 'idx_notifications_recipient_read');
        // Secondary: all notifications for a user (for "mark all read")
        table.index('recipient_id', 'idx_notifications_recipient');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('notifications');
}
