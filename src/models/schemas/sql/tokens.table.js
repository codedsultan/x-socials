"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokensTable = void 0;
exports.tokensTable = {
    tableName: 'tokens',
    up(table, db) {
        table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
        table.uuid('user_id').notNullable();
        table.text('token').notNullable().unique();
        table.string('type', 50).notNullable();
        table.timestamp('expires_at').notNullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
    },
};
//# sourceMappingURL=tokens.table.js.map