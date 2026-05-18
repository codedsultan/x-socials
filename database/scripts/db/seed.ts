/**
 * database/scripts/db/seed.ts
 *
 * Full-stack development seed.
 *
 * Covers every module:  auth · users · follows · posts · comments · likes
 *
 * Design goals:
 *   - Idempotent  — safe to run multiple times; skips already-seeded tables.
 *   - Relational  — MongoDB documents reference real SQL user IDs so the
 *                   social graph is consistent across both databases.
 *   - Readable    — each section is self-contained with a clear header.
 *
 * Run:  pnpm db:seed
 * Reset + seed:  pnpm db:reset
 *
 * Test credentials (all users share the same password):
 *   Password: SeedPass123
 *
 *   alice@example.com   — Admin / power user, followed by everyone
 *   bob@example.com     — Regular user, follows Alice
 *   charlie@example.com — Regular user, follows Alice and Bob
 *   diana@example.com   — Regular user, follows nobody yet
 */

import { ConfigService } from '../../../src/config/config.service';
import { KnexAdapter }    from '../../../src/database/adapters/KnexAdapter';
import { MongooseAdapter } from '../../../src/database/adapters/MongooseAdapter';
import { ModelSchemas }   from '../../../src/models/schemas';
import { generateSqlId }  from '../../../src/utils/uuid';
import bcrypt from 'bcrypt';

// ─── constants ────────────────────────────────────────────────────────────────

const PASSWORD      = 'SeedPass123';
const BCRYPT_ROUNDS = 12;

// ─── helpers ──────────────────────────────────────────────────────────────────

function log(emoji: string, msg: string) { console.log(`${emoji} ${msg}`); }
function ok(msg: string)   { console.log(`   ✅ ${msg}`); }
function skip(msg: string) { console.log(`   ℹ️  ${msg}`); }
function fail(msg: string, err: unknown) {
    console.error(`   ❌ ${msg}:`, err instanceof Error ? err.message : err);
}

async function tableIsEmpty(knex: ReturnType<KnexAdapter['getClient']>, table: string): Promise<boolean> {
    try {
        const row = await knex(table).count('* as n').first();
        return Number(row?.n ?? 0) === 0;
    } catch {
        return true; // table might not exist yet
    }
}

// ─── seed data definitions ────────────────────────────────────────────────────

/**
 * Build the full SQL + Mongo seed dataset.
 * All IDs are pre-generated so cross-database references are consistent.
 */
function buildSeedData(passwordHash: string) {

    // ── users (SQL) ──────────────────────────────────────────────────────────
    const alice   = generateSqlId();
    const bob     = generateSqlId();
    const charlie = generateSqlId();
    const diana   = generateSqlId();

    const now = new Date();
    const users = [
        { id: alice,   email: 'alice@example.com',   password_hash: passwordHash, name: 'Alice Admin',   created_at: now, updated_at: now },
        { id: bob,     email: 'bob@example.com',     password_hash: passwordHash, name: 'Bob Builder',   created_at: now, updated_at: now },
        { id: charlie, email: 'charlie@example.com', password_hash: passwordHash, name: 'Charlie Codes', created_at: now, updated_at: now },
        { id: diana,   email: 'diana@example.com',   password_hash: passwordHash, name: 'Diana Designs', created_at: now, updated_at: now },
    ];

    // ── follows (SQL) ────────────────────────────────────────────────────────
    //  bob     → follows alice
    //  charlie → follows alice, bob
    //  diana   → follows alice
    const follows = [
        { follower_id: bob,     following_id: alice,   created_at: now },
        { follower_id: charlie, following_id: alice,   created_at: now },
        { follower_id: charlie, following_id: bob,     created_at: now },
        { follower_id: diana,   following_id: alice,   created_at: now },
    ];

    // ── posts (MongoDB) ──────────────────────────────────────────────────────
    // Six posts spread across users with different tags
    const posts = [
        {
            authorId:   alice,
            title:      'Welcome to x-socials!',
            content:    'Excited to launch this platform. Drop a comment and say hi — the community is just getting started.',
            tags:       ['announcement', 'community'],
            likesCount: 0,
        },
        {
            authorId:   alice,
            title:      'API design principles I live by',
            content:    'After years of building APIs I keep coming back to the same rules: version everything, use consistent error envelopes, and never break backwards compatibility.',
            tags:       ['api', 'engineering', 'bestpractices'],
            likesCount: 0,
        },
        {
            authorId:   bob,
            title:      'Getting started with MongoDB and Mongoose',
            content:    'NoSQL databases feel daunting at first but once you understand documents and indexes it clicks fast. Here is my starter guide.',
            tags:       ['mongodb', 'database', 'nosql', 'tutorial'],
            likesCount: 0,
        },
        {
            authorId:   bob,
            title:      'Why I switched from REST to tRPC',
            content:    'End-to-end type safety is not a luxury, it is a productivity multiplier. Here is how the migration went.',
            tags:       ['trpc', 'typescript', 'api'],
            likesCount: 0,
        },
        {
            authorId:   charlie,
            title:      'CSS Grid vs Flexbox: when to use which',
            content:    'They are not competing tools — they solve different problems. Use Grid for two-dimensional layouts and Flexbox for one-dimensional alignment.',
            tags:       ['css', 'frontend', 'design'],
            likesCount: 0,
        },
        {
            authorId:   diana,
            title:      'Design tokens: the bridge between design and code',
            content:    'A design token is just a named variable that carries a design decision — colour, spacing, radius. The magic happens when both Figma and your codebase read from the same source.',
            tags:       ['design', 'designsystems', 'frontend'],
            likesCount: 0,
        },
    ];

    return { userIds: { alice, bob, charlie, diana }, users, follows, posts };
}

// ─── SQL seeding ──────────────────────────────────────────────────────────────

async function seedSql(
    knex: ReturnType<KnexAdapter['getClient']>,
    data: ReturnType<typeof buildSeedData>
): Promise<{ seeded: boolean; userIds: ReturnType<typeof buildSeedData>['userIds'] }> {

    const { users, follows, userIds } = data;

    // ── users ────────────────────────────────────────────────────────────────
    if (await tableIsEmpty(knex, 'users')) {
        await knex('users').insert(users);
        ok(`Seeded ${users.length} users`);
    } else {
        skip(`users table already has data — skipping`);
        // Fetch real IDs from DB so Mongo references stay consistent
        const dbUsers = await knex('users').select('id', 'email').whereIn('email', users.map(u => u.email));
        const byEmail = Object.fromEntries(dbUsers.map((u: any) => [u.email, u.id]));
        userIds.alice   = byEmail['alice@example.com']   ?? userIds.alice;
        userIds.bob     = byEmail['bob@example.com']     ?? userIds.bob;
        userIds.charlie = byEmail['charlie@example.com'] ?? userIds.charlie;
        userIds.diana   = byEmail['diana@example.com']   ?? userIds.diana;
        return { seeded: false, userIds };
    }

    // ── follows ──────────────────────────────────────────────────────────────
    if (await tableIsEmpty(knex, 'follows')) {
        await knex('follows').insert(follows);
        ok(`Seeded ${follows.length} follow edges`);
    } else {
        skip('follows table already has data — skipping');
    }

    return { seeded: true, userIds };
}

// ─── Mongo seeding ────────────────────────────────────────────────────────────

async function seedMongo(
    mongoAdapter: MongooseAdapter,
    userIds: ReturnType<typeof buildSeedData>['userIds'],
    postDefinitions: ReturnType<typeof buildSeedData>['posts']
): Promise<{ postIds: string[] }> {

    const postIds: string[] = [];

    // ── posts ────────────────────────────────────────────────────────────────
    const existingPosts = await mongoAdapter.findMany('Post', {}) as any[];
    if (existingPosts.length === 0) {
        for (const def of postDefinitions) {
            const post = await mongoAdapter.create('Post', def) as any;
            postIds.push(post.id as string);
        }
        ok(`Seeded ${postIds.length} posts`);
    } else {
        skip(`Posts collection already has ${existingPosts.length} documents — skipping`);
        existingPosts.forEach((p: any) => postIds.push(p.id as string));
    }

    // ── comments ─────────────────────────────────────────────────────────────
    const existingComments = await mongoAdapter.findMany('Comment', {}) as any[];
    if (existingComments.length === 0 && postIds.length >= 3) {
        const [post0, post1, post2, post3] = postIds;
        const { alice, bob, charlie, diana } = userIds;

        const comments = [
            // Post 0 (Alice — welcome)
            { postId: post0, authorId: bob,     content: 'Great to be here! Loving the platform so far.', parentId: null },
            { postId: post0, authorId: charlie, content: 'Same! The UI is super clean.', parentId: null },
            { postId: post0, authorId: diana,   content: 'Excited to see where this goes 🚀', parentId: null },
            // Reply to Bob's comment (post0, index 0)
            { postId: post0, authorId: alice,   content: 'Thanks Bob, means a lot!', parentId: null }, // will update parentId below

            // Post 1 (Alice — API design)
            { postId: post1, authorId: bob,     content: 'Agreed on versioning. Learned this the hard way.', parentId: null },
            { postId: post1, authorId: charlie, content: 'Do you use OpenAPI spec or handwrite the docs?', parentId: null },

            // Post 2 (Bob — MongoDB)
            { postId: post2, authorId: alice,   content: 'Great intro! One tip: always define indexes before going to prod.', parentId: null },
            { postId: post2, authorId: diana,   content: 'The aggregation pipeline still trips me up. Any resources?', parentId: null },

            // Post 3 (Bob — tRPC)
            { postId: post3, authorId: charlie, content: 'Made the switch last month. The DX is insane.', parentId: null },
        ];

        const createdComments: any[] = [];
        for (const c of comments) {
            const doc = await mongoAdapter.create('Comment', c) as any;
            createdComments.push(doc);
        }

        // Wire the reply: Alice replies to Bob's comment on post0 (index 0)
        if (createdComments[0] && createdComments[3]) {
            await mongoAdapter.update('Comment', createdComments[3].id, { parentId: createdComments[0].id });
        }

        ok(`Seeded ${createdComments.length} comments (with 1 reply thread)`);
    } else {
        skip('Comments collection already has data — skipping');
    }

    // ── likes ─────────────────────────────────────────────────────────────────
    const existingLikes = await mongoAdapter.findMany('Like', {}) as any[];
    if (existingLikes.length === 0 && postIds.length >= 4) {
        const [post0, post1, post2, post3, post4, post5] = postIds;
        const { alice, bob, charlie, diana } = userIds;

        // Each like is unique per (userId, targetId, targetType) — enforced by index
        const likes = [
            // Likes on Alice's posts
            { userId: bob,     targetId: post0, targetType: 'post' },
            { userId: charlie, targetId: post0, targetType: 'post' },
            { userId: diana,   targetId: post0, targetType: 'post' },
            { userId: bob,     targetId: post1, targetType: 'post' },
            { userId: charlie, targetId: post1, targetType: 'post' },

            // Likes on Bob's posts
            { userId: alice,   targetId: post2, targetType: 'post' },
            { userId: charlie, targetId: post2, targetType: 'post' },
            { userId: alice,   targetId: post3, targetType: 'post' },

            // Likes on Charlie's and Diana's posts
            { userId: alice,   targetId: post4, targetType: 'post' },
            { userId: bob,     targetId: post4, targetType: 'post' },
            { userId: bob,     targetId: post5, targetType: 'post' },
            { userId: charlie, targetId: post5, targetType: 'post' },
        ];

        for (const like of likes) {
            await mongoAdapter.create('Like', like);
        }

        // Sync likesCount on each post to match the likes we just inserted
        const countByPost: Record<string, number> = {};
        for (const l of likes) {
            if (l.targetType === 'post') {
                countByPost[l.targetId] = (countByPost[l.targetId] ?? 0) + 1;
            }
        }
        for (const [postId, count] of Object.entries(countByPost)) {
            await mongoAdapter.update('Post', postId, { likesCount: count });
        }

        ok(`Seeded ${likes.length} likes (likesCount synced on all posts)`);
    } else {
        skip('Likes collection already has data — skipping');
    }

    return { postIds };
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function seed() {
    if (process.env['NODE_ENV'] === 'production') {
        console.error('❌ Seed must not run in production');
        process.exit(1);
    }

    console.log('\n🌱 Seeding x-socials database...\n');

    const dbConfig  = ConfigService.getDatabaseConfig();
    const hash      = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);
    const seedData  = buildSeedData(hash);
    let   userIds   = seedData.userIds;

    // ── SQL ───────────────────────────────────────────────────────────────────
    const sqlCandidates: Array<{ name: string; adapter: KnexAdapter }> = [];

    if (dbConfig.sqlite) {
        sqlCandidates.push({
            name: 'SQLite',
            adapter: new KnexAdapter({
                client:          dbConfig.sqlite.client ?? 'better-sqlite3',
                connection:      { filename: dbConfig.sqlite.filename },
                useNullAsDefault: true,
            }, { skipMigrations: true }),
        });
    }
    if (dbConfig.mysql) {
        sqlCandidates.push({
            name: 'MySQL',
            adapter: new KnexAdapter({
                client:     dbConfig.mysql.client ?? 'mysql2',
                connection: {
                    host:     dbConfig.mysql.host,
                    port:     dbConfig.mysql.port,
                    database: dbConfig.mysql.database,
                    user:     dbConfig.mysql.user,
                    password: dbConfig.mysql.password,
                },
            }, { skipMigrations: true }),
        });
    }
    if (dbConfig.postgres) {
        sqlCandidates.push({
            name: 'PostgreSQL',
            adapter: new KnexAdapter({
                client:     dbConfig.postgres.client ?? 'pg',
                connection: {
                    host:     dbConfig.postgres.host,
                    port:     dbConfig.postgres.port,
                    database: dbConfig.postgres.database,
                    user:     dbConfig.postgres.user,
                    password: dbConfig.postgres.password,
                    ssl:      (dbConfig.postgres as any).ssl ? { rejectUnauthorized: false } : false,
                },
                pool: { min: 0, max: 5 },
            }, { skipMigrations: true }),
        });
    }

    if (sqlCandidates.length === 0) {
        log('⚠️', 'No SQL database configured — skipping SQL seed');
    }

    for (const { name, adapter } of sqlCandidates) {
        log('📦', `Seeding ${name}...`);
        try {
            await adapter.connect();

            // Register SQL models so the adapter knows table names
            for (const [modelName, schema] of Object.entries(ModelSchemas)) {
                adapter.registerModel(modelName, schema);
            }

            const knex = adapter.getClient();
            const result = await seedSql(knex, { ...seedData, userIds });
            userIds = result.userIds; // update with DB-resolved IDs if tables existed

            await adapter.disconnect();
        } catch (err) {
            fail(`${name} seed failed`, err);
        }
        console.log('');
    }

    // ── MongoDB ───────────────────────────────────────────────────────────────
    if (!dbConfig.mongodb) {
        log('⚠️', 'No MongoDB configured — skipping Mongo seed');
    } else {
        log('📦', 'Seeding MongoDB...');
        const mongoAdapter = new MongooseAdapter(dbConfig.mongodb);
        try {
            await mongoAdapter.connect();

            // Register all Mongo models with their index definitions
            for (const [modelName, schema] of Object.entries(ModelSchemas)) {
                mongoAdapter.registerModel(modelName, schema);
            }

            // Rebuild posts with real user IDs (may have changed if SQL tables existed)
            const postsWithRealIds = seedData.posts.map(p => ({
                ...p,
                authorId: userIds[p.authorId as keyof typeof userIds] ?? p.authorId,
            }));

            await seedMongo(mongoAdapter, userIds, postsWithRealIds);
            await mongoAdapter.disconnect();
        } catch (err) {
            fail('MongoDB seed failed', err);
        }
        console.log('');
    }

    // ── summary ───────────────────────────────────────────────────────────────
    console.log('✅ Seed complete!\n');
    console.log('📋 Test accounts (password for all: SeedPass123)\n');
    console.log('   alice@example.com   — Alice Admin    (followed by bob, charlie, diana)');
    console.log('   bob@example.com     — Bob Builder    (follows alice; followed by charlie)');
    console.log('   charlie@example.com — Charlie Codes  (follows alice + bob)');
    console.log('   diana@example.com   — Diana Designs  (follows alice)\n');
    console.log('📊 Seeded content per environment:');
    console.log('   SQL  — 4 users · 4 follow edges');
    console.log('   Mongo — 6 posts · 9 comments (1 reply thread) · 12 likes\n');
    console.log('💡 Usage:');
    console.log('   POST /api/auth/login  { "email": "alice@example.com", "password": "SeedPass123" }');
    console.log('   GET  /api/feed        (home feed — posts from followed users)');
    console.log('   GET  /api/posts       (all posts)');
    console.log('   GET  /api/users       (all users)\n');

    process.exit(0);
}

seed().catch(err => {
    console.error('\n💥 Seed crashed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
