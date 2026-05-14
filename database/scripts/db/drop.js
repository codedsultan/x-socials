"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// scripts/db/drop.ts
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
            adapter: new KnexAdapter_1.KnexAdapter(config),
            config
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
            adapter: new KnexAdapter_1.KnexAdapter(config),
            config
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
            adapter: new KnexAdapter_1.KnexAdapter(config),
            config
        });
    }
    return adapters;
}
async function dropAllTables(knex, dbType) {
    try {
        if (dbType === 'mysql') {
            // MySQL - disable foreign key checks
            await knex.raw('SET FOREIGN_KEY_CHECKS = 0');
            const tables = await knex('information_schema.tables')
                .select('table_name')
                .where('table_schema', knex.client.config.connection.database);
            for (const row of tables) {
                const tableName = row.table_name || row.TABLE_NAME;
                if (tableName && !tableName.startsWith('knex_')) {
                    await knex.schema.dropTableIfExists(tableName);
                    console.log(`      Dropped: ${tableName}`);
                }
            }
            await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
        }
        else if (dbType === 'postgres') {
            // PostgreSQL - drop with CASCADE
            const tables = await knex('information_schema.tables')
                .select('table_name')
                .where('table_schema', 'public')
                .whereNot('table_name', 'like', 'knex_%');
            for (const row of tables) {
                const tableName = row.table_name || row.TABLE_NAME;
                if (tableName) {
                    await knex.raw(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
                    console.log(`      Dropped: ${tableName}`);
                }
            }
        }
        else if (dbType === 'sqlite') {
            // SQLite - get all tables
            const tables = await knex('sqlite_master')
                .select('name')
                .where('type', 'table')
                .whereNot('name', 'like', 'sqlite_%')
                .whereNot('name', 'like', 'knex_%');
            for (const row of tables) {
                const tableName = row.name;
                if (tableName) {
                    await knex.schema.dropTableIfExists(tableName);
                    console.log(`      Dropped: ${tableName}`);
                }
            }
        }
    }
    catch (error) {
        console.error(`Error dropping tables for ${dbType}:`, error);
        throw error;
    }
}
async function drop() {
    console.log('🗑️  Dropping all tables...\n');
    const adapters = await getAdapters();
    if (adapters.length === 0) {
        console.log('ℹ️  No database adapters configured');
        process.exit(0);
    }
    let successCount = 0;
    let failureCount = 0;
    for (const { name, adapter } of adapters) {
        try {
            console.log(`📦 Processing ${name.toUpperCase()}...`);
            await adapter.connect();
            const knex = adapter.getClient();
            // Drop all application tables
            console.log(`   🗑️  Dropping tables...`);
            await dropAllTables(knex, name);
            // Drop migration tracking tables
            console.log(`   🧹 Cleaning migration records...`);
            await knex.schema.dropTableIfExists('knex_migrations');
            await knex.schema.dropTableIfExists('knex_migrations_lock');
            await adapter.disconnect();
            console.log(`   ✅ ${name} cleaned successfully`);
            successCount++;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`   ❌ ${name} failed:`, errorMessage);
            failureCount++;
        }
        console.log('');
    }
    console.log(`📊 Summary: ${successCount} succeeded, ${failureCount} failed`);
    if (failureCount > 0) {
        console.log('\n⚠️  Some databases failed to drop. You may need to drop them manually.');
        console.log('\nManual cleanup commands:');
        console.log('  MySQL: mysql -u root -p -e "DROP DATABASE IF EXISTS x_socials; CREATE DATABASE x_socials;"');
        console.log('  SQLite: rm -f data/dev.sqlite');
        process.exit(1);
    }
    console.log('✅ All tables dropped successfully');
    process.exit(0);
}
drop().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Drop failed:', errorMessage);
    process.exit(1);
});
//# sourceMappingURL=drop.js.map