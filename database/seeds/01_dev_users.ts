/**
 * Development seed — inserts test users with real bcrypt hashes.
 *
 * Credentials:
 *   alice@example.com / DevPass123
 *   bob@example.com   / DevPass123
 *
 * Run with: pnpm db:seed  (or: npx knex seed:run --knexfile knexfile.ts)
 * NEVER runs in production — guarded below.
 */
import type { Knex } from 'knex';
import { generateSqlId } from '../../src/utils/uuid';

// Pre-computed bcrypt hash of 'DevPass123' at cost factor 12.
// Regenerate with: node -e "require('bcrypt').hash('DevPass123',12).then(console.log)"
const HASH = '$2b$12$EfpzaW/X.RZMFetXN5tDWOs.OwoVniroo0KJ.JgooyRgqn8OKI6x2';

const SEED_USERS = [
    { email: 'alice@example.com', name: 'Alice Dev', password_hash: HASH },
    { email: 'bob@example.com',   name: 'Bob Dev',   password_hash: HASH },
];

export async function seed(knex: Knex): Promise<void> {
    if (process.env['NODE_ENV'] === 'production') {
        throw new Error('Seeds must not run in production');
    }

    for (const user of SEED_USERS) {
        const existing = await knex('users').where({ email: user.email }).first();
        if (!existing) {
            await knex('users').insert({
                id: generateSqlId(),
                ...user,
                created_at: new Date(),
                updated_at: new Date(),
            });
        }
    }

    console.log(`Seeded ${SEED_USERS.length} dev users (alice & bob, password: DevPass123)`);
}
