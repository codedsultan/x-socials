"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// scripts/db/seed.ts
const config_service_1 = require("../../../src/config/config.service");
const KnexAdapter_1 = require("../../../src/database/adapters/KnexAdapter");
const MongooseAdapter_1 = require("../../../src/database/adapters/MongooseAdapter");
const uuid_1 = require("uuid");
const bcrypt_1 = __importDefault(require("bcrypt"));
async function seed() {
    console.log('🌱 Seeding database...\n');
    const dbConfig = config_service_1.ConfigService.getDatabaseConfig();
    // Seed SQL Databases (MySQL, SQLite)
    const sqlAdapters = [];
    if (dbConfig.sqlite) {
        const config = {
            client: dbConfig.sqlite.client || 'better-sqlite3',
            connection: { filename: dbConfig.sqlite.filename },
            useNullAsDefault: true
        };
        sqlAdapters.push({ name: 'sqlite', adapter: new KnexAdapter_1.KnexAdapter(config) });
    }
    if (dbConfig.mysql) {
        const config = {
            client: dbConfig.mysql.client || 'mysql2',
            connection: {
                host: dbConfig.mysql.host,
                port: dbConfig.mysql.port,
                database: dbConfig.mysql.database,
                user: dbConfig.mysql.user,
                password: dbConfig.mysql.password
            }
        };
        sqlAdapters.push({ name: 'mysql', adapter: new KnexAdapter_1.KnexAdapter(config) });
    }
    // Seed SQL data
    for (const { name, adapter } of sqlAdapters) {
        try {
            console.log(`📦 Seeding ${name.toUpperCase()}...`);
            await adapter.connect();
            const knex = adapter.getClient();
            // Check if users table has data
            const userCount = await knex('users').count('id as count').first();
            const existingCount = Number(userCount?.count) || 0;
            if (existingCount === 0) {
                const hashedPassword = await bcrypt_1.default.hash('password123', 10);
                const users = [
                    {
                        id: (0, uuid_1.v7)(),
                        email: 'admin@example.com',
                        password_hash: hashedPassword,
                        name: 'Admin User',
                        created_at: new Date(),
                        updated_at: new Date()
                    },
                    {
                        id: (0, uuid_1.v7)(),
                        email: 'user1@example.com',
                        password_hash: hashedPassword,
                        name: 'John Doe',
                        created_at: new Date(),
                        updated_at: new Date()
                    },
                    {
                        id: (0, uuid_1.v7)(),
                        email: 'user2@example.com',
                        password_hash: hashedPassword,
                        name: 'Jane Smith',
                        created_at: new Date(),
                        updated_at: new Date()
                    }
                ];
                await knex('users').insert(users);
                console.log(`   ✅ Seeded ${users.length} users to ${name}`);
            }
            else {
                console.log(`   ℹ️  ${name} already has ${existingCount} users`);
            }
            await adapter.disconnect();
        }
        catch (error) {
            console.error(`   ❌ ${name} seeding failed:`, error);
        }
        console.log('');
    }
    // Seed MongoDB
    // In scripts/db/seed.ts, update the MongoDB seeding section
    if (dbConfig.mongodb) {
        console.log('📦 Seeding MONGODB...');
        try {
            const mongoAdapter = new MongooseAdapter_1.MongooseAdapter(dbConfig.mongodb);
            await mongoAdapter.connect();
            // Register Post model
            const postSchema = {
                mongo: {
                    title: { type: String, required: true },
                    content: { type: String, required: true },
                    authorId: { type: String, required: true },
                    tags: [{ type: String }],
                    likesCount: { type: Number, default: 0 },
                    createdAt: { type: Date, default: Date.now },
                    updatedAt: { type: Date, default: Date.now }
                }
            };
            mongoAdapter.registerModel('Post', postSchema);
            // Check if posts already exist
            const existingPosts = await mongoAdapter.findMany('Post', {});
            if (existingPosts.length === 0) {
                // Create sample posts with likes
                const posts = [
                    {
                        title: 'Welcome to the Platform!',
                        content: 'This is your first post. Share your thoughts and ideas with the community.',
                        authorId: 'user1-id',
                        tags: ['welcome', 'introduction'],
                        likesCount: 5,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    },
                    {
                        title: 'Best Practices for API Design',
                        content: 'RESTful API design tips and tricks for better developer experience.',
                        authorId: 'user2-id',
                        tags: ['api', 'development', 'rest'],
                        likesCount: 12,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    },
                    {
                        title: 'Getting Started with MongoDB',
                        content: 'A beginner\'s guide to MongoDB and NoSQL databases.',
                        authorId: 'admin-id',
                        tags: ['mongodb', 'database', 'nosql'],
                        likesCount: 8,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                ];
                for (const post of posts) {
                    await mongoAdapter.create('Post', post);
                }
                console.log(`   ✅ Seeded ${posts.length} posts to MongoDB`);
            }
            else {
                console.log(`   ℹ️  MongoDB already has ${existingPosts.length} posts`);
            }
            await mongoAdapter.disconnect();
        }
        catch (error) {
            console.error('   ❌ MongoDB seeding failed:', error);
        }
        console.log('');
    }
    console.log('✅ Seeding complete!');
    console.log('\n📝 Test credentials:');
    console.log('   SQL Users:');
    console.log('     Email: admin@example.com');
    console.log('     Password: password123');
    console.log('     Email: user1@example.com');
    console.log('     Password: password123');
    console.log('\n   MongoDB Posts: 3 sample posts available');
    process.exit(0);
}
seed().catch(error => {
    console.error('Seeding failed:', error);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map