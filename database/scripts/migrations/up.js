"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// scripts/migrations/up.ts
const config_service_1 = require("../../../src/config/config.service");
const KnexAdapter_1 = require("../../../src/database/adapters/KnexAdapter");
async function getAdapters() {
    const dbConfig = config_service_1.ConfigService.getDatabaseConfig();
    const adapters = [];
    // SQLite
    if (dbConfig.sqlite) {
        const config = {
            client: dbConfig.sqlite.client || 'better-sqlite3',
            connection: { filename: dbConfig.sqlite.filename },
            useNullAsDefault: true
        };
        adapters.push({
            name: 'sqlite',
            adapter: new KnexAdapter_1.KnexAdapter(config)
        });
    }
    // MySQL
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
        adapters.push({
            name: 'mysql',
            adapter: new KnexAdapter_1.KnexAdapter(config)
        });
    }
    // PostgreSQL
    if (dbConfig.postgres) {
        const config = {
            client: dbConfig.postgres.client || 'pg',
            connection: {
                host: dbConfig.postgres.host,
                port: dbConfig.postgres.port,
                database: dbConfig.postgres.database,
                user: dbConfig.postgres.user,
                password: dbConfig.postgres.password,
                ssl: dbConfig.postgres.ssl || false
            }
        };
        adapters.push({
            name: 'postgres',
            adapter: new KnexAdapter_1.KnexAdapter(config)
        });
    }
    return adapters;
}
async function up() {
    console.log('🚀 Running migrations...\n');
    const adapters = await getAdapters();
    if (adapters.length === 0) {
        console.log('ℹ️  No database adapters configured');
        process.exit(0);
    }
    let successCount = 0;
    let failureCount = 0;
    for (const { name, adapter } of adapters) {
        try {
            console.log(`📦 Migrating ${name.toUpperCase()}...`);
            await adapter.connect();
            const migrations = await adapter.runMigrations();
            if (migrations.length === 0) {
                console.log(`   ✅ ${name} already up to date`);
            }
            else {
                console.log(`   ✅ ${name} ran ${migrations.length} migration(s):`);
                migrations.forEach(m => console.log(`      - ${m}`));
            }
            await adapter.disconnect();
            successCount++;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`   ❌ ${name} migration failed:`, errorMessage);
            failureCount++;
        }
        console.log('');
    }
    console.log(`📊 Summary: ${successCount} succeeded, ${failureCount} failed`);
    if (failureCount > 0) {
        process.exit(1);
    }
    console.log('✅ All migrations completed successfully');
    process.exit(0);
}
up().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Migration failed:', errorMessage);
    process.exit(1);
});
//# sourceMappingURL=up.js.map