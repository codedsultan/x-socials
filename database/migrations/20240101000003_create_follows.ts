// migrations/20240101000003_create_follows.ts
import type { Knex } from 'knex';

/**
 * Follows table — social graph edges.
 *
 * Design decisions:
 *   - Composite PK (follower_id, following_id) replaces a surrogate id.
 *     A user can follow another user exactly once — the PK enforces this
 *     at the database level, eliminating the need for a separate unique index.
 *   - No updated_at — a follow is created or deleted, never updated.
 *   - Separate index on following_id enables "who follows user X?" queries,
 *     which are needed for follower counts and notification fanning.
 */
export async function up(knex: Knex): Promise<void> {
    if (await knex.schema.hasTable('follows')) {
        console.log('Table follows already exists, skipping');
        return;
    }

    await knex.schema.createTable('follows', (table) => {
        // Composite primary key — enforces one-follow-per-pair at the DB level
        table.string('follower_id', 36).notNullable();
        table.string('following_id', 36).notNullable();
        table.primary(['follower_id', 'following_id']);

        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

        // Foreign keys — CASCADE delete keeps graph consistent when a user is removed
        table.foreign('follower_id').references('id').inTable('users').onDelete('CASCADE');
        table.foreign('following_id').references('id').inTable('users').onDelete('CASCADE');

        // "Who does user X follow?" — covered by the PK (leading column = follower_id)
        // "Who follows user X?" — needs this explicit index
        table.index('following_id', 'idx_follows_following_id');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('follows');
}
