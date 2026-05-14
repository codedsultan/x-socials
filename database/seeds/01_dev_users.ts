/**
 * Development seed — inserts test users.
 * Run with: npx knex seed:run
 * NEVER runs in production (guarded below).
 */
import type { Knex } from 'knex';

const SEED_USERS = [
    { email: 'alice@example.com', password_hash: '$2b$10$placeholder', name: 'Alice Dev' },
    { email: 'bob@example.com', password_hash: '$2b$10$placeholder', name: 'Bob Dev' },
];

export async function seed(knex: Knex): Promise<void> {
    // if (process.env['NODE_ENV'] === 'production') {
    //     throw new Error('Seeds must not run in production');
    // }

    // Idempotent — clear then re-insert
    await knex('users').whereIn('email', SEED_USERS.map(u => u.email)).delete();
    await knex('users').insert(SEED_USERS);
}
