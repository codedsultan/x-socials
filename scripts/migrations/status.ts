// scripts/migrations/status.ts
import { ConfigService } from '../../src/config/config.service';
import { KnexAdapter } from '../../src/database/adapters/KnexAdapter';

// Simple table formatter without external dependency
function createTable(data: Array<[string, string]>): string {
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

async function getAdapters(): Promise<{ name: string; adapter: KnexAdapter }[]> {
    const dbConfig = ConfigService.getDatabaseConfig();
    const adapters: { name: string; adapter: KnexAdapter }[] = [];

    if (dbConfig.sqlite) {
        const config = {
            client: dbConfig.sqlite.client || 'better-sqlite3',
            connection: { filename: dbConfig.sqlite.filename },
            useNullAsDefault: true
        };
        adapters.push({ name: 'sqlite', adapter: new KnexAdapter(config) });
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
        adapters.push({ name: 'mysql', adapter: new KnexAdapter(config) });
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
        adapters.push({ name: 'postgres', adapter: new KnexAdapter(config) });
    }

    return adapters;
}

async function status(): Promise<void> {
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

            const tableData: Array<[string, string]> = [
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
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`   ❌ Failed to get status for ${name}:`, errorMessage);
        }
        console.log('');
    }

    process.exit(0);
}

status().catch((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Status check failed:', errorMessage);
    process.exit(1);
});