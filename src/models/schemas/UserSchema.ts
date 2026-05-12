export const userSchema = {
    tableName: 'users',
    // For SQL (Knex migration)
    up: (table: any, db: any) => {
        table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
        table.string('email').unique().notNullable();
        table.string('passwordHash').notNullable();
        table.string('name');
        table.timestamp('createdAt').defaultTo(db.fn.now());
        table.timestamp('updatedAt').defaultTo(db.fn.now());
    },
    // For MongoDB (Mongoose schema)
    mongoose: {
        email: { type: String, required: true, unique: true },
        passwordHash: { type: String, required: true },
        name: String,
    },
};
