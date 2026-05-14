"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seed = seed;
const SEED_USERS = [
    { email: 'alice@example.com', password_hash: '$2b$10$placeholder', name: 'Alice Dev' },
    { email: 'bob@example.com', password_hash: '$2b$10$placeholder', name: 'Bob Dev' },
];
async function seed(knex) {
    // if (process.env['NODE_ENV'] === 'production') {
    //     throw new Error('Seeds must not run in production');
    // }
    // Idempotent — clear then re-insert
    await knex('users').whereIn('email', SEED_USERS.map(u => u.email)).delete();
    await knex('users').insert(SEED_USERS);
}
//# sourceMappingURL=01_dev_users.js.map