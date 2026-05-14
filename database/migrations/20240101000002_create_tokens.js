"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    const exists = await knex.schema.hasTable('tokens');
    if (!exists) {
        await knex.schema.createTable('tokens', (table) => {
            table.string('id', 36).primary();
            table.string('user_id', 36).notNullable();
            table.string('token', 512).notNullable();
            table.string('type', 50).notNullable();
            table.timestamp('expires_at').notNullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
            table.index('user_id');
            table.index('type');
            table.index('expires_at');
            table.unique('token');
        });
    }
    else {
        console.log('Table tokens already exists, skipping creation');
    }
}
async function down(knex) {
    await knex.schema.dropTableIfExists('tokens');
}
//# sourceMappingURL=20240101000002_create_tokens.js.map