export const postSchema = {
    tableName: 'posts',
    up: (table: any, db: any) => {
        table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
        table.string('title').notNullable();
        table.text('content').notNullable();
        table.uuid('authorId').notNullable();
        table.specificType('tags', 'text[]');
        table.integer('likesCount').defaultTo(0);
        table.timestamp('createdAt').defaultTo(db.fn.now());
        table.timestamp('updatedAt').defaultTo(db.fn.now());
    },
    mongoose: {
        title: { type: String, required: true },
        content: { type: String, required: true },
        authorId: { type: String, required: true },
        tags: [String],
        likesCount: { type: Number, default: 0 },
    },
};