// scripts/db/drop.ts - Complete file with better debugging

import { ConfigService } from '../../../src/config/config.service';
import { KnexAdapter } from '../../../src/database/adapters/KnexAdapter';
import mongoose from 'mongoose';
import type { Knex } from 'knex';

interface AdapterInfo {
    name: string;
    adapter: KnexAdapter;
    config: any;
}

async function getAdapters(): Promise<AdapterInfo[]> {
    const dbConfig = ConfigService.getDatabaseConfig();
    const adapters: AdapterInfo[] = [];

    // SQLite
    if (dbConfig.sqlite) {
        const config = {
            client: dbConfig.sqlite.client || 'better-sqlite3',
            connection: { filename: dbConfig.sqlite.filename },
            useNullAsDefault: true
        };
        adapters.push({
            name: 'sqlite',
            adapter: new KnexAdapter(config),
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
            adapter: new KnexAdapter(config),
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
            adapter: new KnexAdapter(config),
            config
        });
    }

    return adapters;
}

async function dropAllTables(knex: Knex, dbType: string): Promise<void> {
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
    } catch (error) {
        console.error(`Error dropping tables for ${dbType}:`, error);
        throw error;
    }
}

async function dropMongoDB(): Promise<{ success: boolean; error?: string }> {
    const dbConfig = ConfigService.getDatabaseConfig();

    // Check if MongoDB is configured
    if (!dbConfig.mongodb) {
        console.log('   ℹ️  No MongoDB configured - skipping');
        return { success: true };
    }

    try {
        console.log('   🗑️  Dropping MongoDB database...');

        const mongoConfig = dbConfig.mongodb;
        const dbName = mongoConfig.dbName || 'test';

        // Get the MongoDB URI
        const uri = mongoConfig.uri;
        console.log(`      Connecting to: ${uri.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials

        // Disconnect any existing connections first
        if (mongoose.connection.readyState !== 0) {
            console.log('      Disconnecting existing connections...');
            await mongoose.disconnect();
        }

        // Connect to MongoDB
        console.log('      Establishing new connection...');
        await mongoose.connect(uri, {
            dbName: dbName,
        });

        console.log(`      Connected to database: ${mongoose.connection.name}`);

        // Try to drop the database
        if (mongoose.connection.db) {
            await mongoose.connection.db.dropDatabase();
            console.log(`      ✅ Dropped MongoDB database: ${dbName}`);
        } else {
            // Fallback: Drop collections one by one
            console.log('      ⚠️  Direct database drop unavailable, dropping collections...');
            const collections = mongoose.connection.collections;
            const collectionNames = Object.keys(collections);

            if (collectionNames.length === 0) {
                console.log('      ℹ️  No collections found to drop');
            } else {
                console.log(`      Found ${collectionNames.length} collections to drop`);
                for (const collectionName of collectionNames) {
                    try {
                        await mongoose.connection.collections[collectionName].drop();
                        console.log(`      Dropped collection: ${collectionName}`);
                    } catch (err: any) {
                        if (err.codeName === 'NamespaceNotFound') {
                            console.log(`      Collection already dropped: ${collectionName}`);
                        } else {
                            console.log(`      Error dropping ${collectionName}:`, err.message);
                        }
                    }
                }
                console.log(`      ✅ Dropped ${collectionNames.length} collections`);
            }
        }

        // Disconnect after dropping
        await mongoose.disconnect();
        console.log('   ✅ MongoDB cleaned successfully');
        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ MongoDB drop failed:`, errorMessage);

        // Additional debugging info
        if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
            console.log('   💡 MongoDB appears to be not running. Please start MongoDB first.');
        } else if (error instanceof Error && error.message.includes('Authentication failed')) {
            console.log('   💡 MongoDB authentication failed. Check your credentials in .env');
        } else {
            console.log('   💡 Make sure MongoDB is running and the URI in .env is correct');
        }

        return { success: false, error: errorMessage };
    }
}

async function drop(): Promise<void> {
    console.log('🗑️  Dropping all tables and databases...\n');

    const adapters = await getAdapters();
    let successCount = 0;
    let failureCount = 0;

    // Drop SQL databases
    if (adapters.length > 0) {
        console.log('📊 Processing SQL databases:\n');

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
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`   ❌ ${name} failed:`, errorMessage);
                failureCount++;
            }
            console.log('');
        }
    } else {
        console.log('ℹ️  No SQL databases configured\n');
    }

    // Drop MongoDB
    console.log('📊 Processing MongoDB:\n');
    const mongoResult = await dropMongoDB();

    if (mongoResult.success) {
        successCount++;
    } else {
        failureCount++;
    }
    console.log('');

    console.log(`📊 Summary: ${successCount} succeeded, ${failureCount} failed`);

    if (failureCount > 0) {
        console.log('\n⚠️  Some databases failed to drop. You may need to drop them manually.');
        console.log('\nManual cleanup commands:');

        // Show manual commands for configured SQL databases
        const dbConfig = ConfigService.getDatabaseConfig();
        if (dbConfig.mysql) {
            console.log(`  MySQL: mysql -u ${dbConfig.mysql.user || 'root'} -p -e "DROP DATABASE IF EXISTS ${dbConfig.mysql.database}; CREATE DATABASE ${dbConfig.mysql.database};"`);
        }
        if (dbConfig.sqlite) {
            console.log(`  SQLite: rm -f ${dbConfig.sqlite.filename}`);
        }
        if (dbConfig.postgres) {
            console.log(`  PostgreSQL: psql -U ${dbConfig.postgres.user || 'postgres'} -c "DROP DATABASE IF EXISTS ${dbConfig.postgres.database};" -c "CREATE DATABASE ${dbConfig.postgres.database};"`);
        }
        if (dbConfig.mongodb) {
            const mongoDbName = dbConfig.mongodb.dbName || 'test';
            console.log(`  MongoDB: Use MongoDB Compass or run: mongosh --eval "db.getSiblingDB('${mongoDbName}').dropDatabase()"`);
        }

        process.exit(1);
    }

    console.log('✅ All databases cleaned successfully');
    process.exit(0);
}

drop().catch((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Drop failed:', errorMessage);
    process.exit(1);
});