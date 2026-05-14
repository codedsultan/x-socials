/**
 * knexfile.ts — Knex CLI configuration
 */

import 'dotenv/config';
import type { Knex } from 'knex';
import path from 'path';

function requireEnv(key: string): string {
    const val = process.env[key];
    if (!val) throw new Error(`knexfile: missing required env var ${key}`);
    return val;
}

function getNum(key: string, fallback: number): number {
    return parseInt(process.env[key] ?? String(fallback), 10);
}

// ─── shared migration/seed paths (UPDATED for new folder structure) ─────────

const migrations: Knex.MigratorConfig = {
    // Now pointing to root database folder, not src/database
    directory: path.join(__dirname, 'database/migrations'),
    tableName: 'knex_migrations',
    loadExtensions: ['.ts'],
    stub: path.join(__dirname, 'database/migrations/migration.stub.ts'),
};

const seeds: Knex.SeederConfig = {
    directory: path.join(__dirname, 'database/seeds'),
    loadExtensions: ['.ts'],
};

// ─── PostgreSQL Configuration (UNCOMMENTED) ─────────────────────────────────

function pgConfig(): Knex.Config {
    return {
        client: process.env['PG_CLIENT'] ?? 'pg',
        connection: {
            host: process.env['PG_HOST'] ?? 'localhost',
            port: getNum('PG_PORT', 5432),
            database: process.env['PG_DATABASE'] ?? requireEnv('PG_DATABASE'),
            user: process.env['PG_USER'],
            password: process.env['PG_PASSWORD'],
            ssl: process.env['PG_SSL'] === 'true'
                ? { rejectUnauthorized: false }
                : false,
        },
        pool: {
            min: getNum('PG_POOL_MIN', 2),
            max: getNum('PG_POOL_MAX', 10),
        },
        migrations,
        seeds,
    };
}

// ─── MySQL (optional) ─────────────────────────────────────────────────────────

function mysqlConfig(): Knex.Config {
    return {
        client: process.env['MYSQL_CLIENT'] ?? 'mysql2',
        connection: {
            host: process.env['MYSQL_HOST'] ?? 'localhost',
            port: getNum('MYSQL_PORT', 3306),
            database: process.env['MYSQL_DATABASE'] ?? requireEnv('MYSQL_DATABASE'),
            user: process.env['MYSQL_USER'],
            password: process.env['MYSQL_PASSWORD'],
        },
        pool: {
            min: getNum('MYSQL_POOL_MIN', 2),
            max: getNum('MYSQL_POOL_MAX', 10),
        },
        migrations,
        seeds,
    };
}

// ─── SQLite (local dev / CI without a DB server) ───────────────────────────────

function sqliteConfig(): Knex.Config {
    return {
        client: process.env['SQLITE_CLIENT'] ?? 'better-sqlite3',
        connection: {
            filename: process.env['SQLITE_FILENAME'] ?? './dev.sqlite',
        },
        useNullAsDefault: true,
        migrations,
        seeds,
    };
}

// ─── Environment blocks (UPDATED) ──────────────────────────────────────────────

const config: Record<string, Knex.Config> = {
    development: mysqlConfig(),
    staging: pgConfig(),
    production: pgConfig(),
    test: sqliteConfig(),

    // Convenience aliases
    postgres: pgConfig(),
    mysql: mysqlConfig(),
    sqlite: sqliteConfig(),
};

export default config;