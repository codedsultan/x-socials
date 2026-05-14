"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// scripts/migrations/status.ts
const config_service_1 = require("../../../src/config/config.service");
const KnexAdapter_1 = require("../../../src/database/adapters/KnexAdapter");
// Simple table formatter without external dependency
function createTable(data) {
    const maxKeyLen = Math.max(...data.map(([key]) => key.length));
    const maxValueLen = Math.max(...data.map(([, value]) => value.length));
    const width = maxKeyLen + maxValueLen + 7;
    let table = '┌' + '─'.repeat(width - 2) + '┐\n';
    for (const [key, value] of data) {
        table += `│ ${key.padEnd(maxKeyLen)} │ ${value.padEnd(maxValueLen)} │\n`;
    }
    table += '└' + '─'.repeat(width - 2) + '┘';
    return table;
}
async function getAdapters() {
    const dbConfig = config_service_1.ConfigService.getDatabaseConfig();
    const adapters = [];
    if (dbConfig.sqlite) {
        const config = {
            client: dbConfig.sqlite.client || 'better-sqlite3',
            connection: { filename: dbConfig.sqlite.filename },
            useNullAsDefault: true
        };
        adapters.push({ name: 'sqlite', adapter: new KnexAdapter_1.KnexAdapter(config) });
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
        adapters.push({ name: 'mysql', adapter: new KnexAdapter_1.KnexAdapter(config) });
    }
    if (dbConfig.postgres) {
        const config = {
            client: dbConfig.postgres.client || 'pg',
            connection: {
                host: dbConfig.postgres.host,
                port: dbConfig.postgres.port,
                database: dbConfig.postgres.database,
                user: dbConfig.postgres.user,
                password: dbConfig.postgres.password
            }
        };
        adapters.push({ name: 'postgres', adapter: new KnexAdapter_1.KnexAdapter(config) });
    }
    return adapters;
}
async function status() {
    console.log('📊 Migration Status\n');
    const adapters = await getAdapters();
    if (adapters.length === 0) {
        console.log('ℹ️  No database adapters configured');
        process.exit(0);
    }
    for (const { name, adapter } of adapters) {
        try {
            console.log(`📦 ${name.toUpperCase()}:`);
            await adapter.connect();
            const migrationStatus = await adapter.getMigrationStatus();
            const tableData = [
                ['Status', migrationStatus.pending === 0 ? '✅ Up to date' : '⚠️  Pending migrations'],
                ['Completed Migrations', migrationStatus.completed.toString()],
                ['Pending Migrations', migrationStatus.pending.toString()]
            ];
            if (migrationStatus.lastRun) {
                tableData.push(['Last Migration', migrationStatus.lastRun]);
            }
            if (migrationStatus.pendingMigrations && migrationStatus.pendingMigrations.length > 0) {
                tableData.push(['Pending Files', migrationStatus.pendingMigrations.join('\n')]);
            }
            console.log(createTable(tableData));
            await adapter.disconnect();
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`   ❌ Failed to get status for ${name}:`, errorMessage);
        }
        console.log('');
    }
    process.exit(0);
}
status().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Status check failed:', errorMessage);
    process.exit(1);
});
//# sourceMappingURL=status.js.map