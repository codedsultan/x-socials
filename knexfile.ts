/**
 * knexfile.ts — Knex CLI configuration
 *
 * Used by `knex migrate:*` and `knex seed:*` commands.
 * Reads the same environment variables as the application so there is
 * exactly one source of truth for connection settings.
 *
 * Usage:
 *   npx knex migrate:latest          # run all pending migrations
 *   npx knex migrate:rollback        # roll back the last batch
 *   npx knex migrate:rollback --all  # roll back everything
 *   npx knex migrate:status          # show what has / hasn't run
 *   npx knex migrate:make <name>     # scaffold a new migration file
 *   npx knex seed:run                # run seeds (dev/staging only)
 *
 * All commands accept --env <environment> to pick a config block.
 * Default is NODE_ENV or 'development'.
 */

import 'dotenv/config';
import type { Knex } from 'knex';
import path from 'path';

// ─── helpers ──────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
    const val = process.env[key];
    if (!val) throw new Error(`knexfile: missing required env var ${key}`);
    return val;
}

function getNum(key: string, fallback: number): number {
    return parseInt(process.env[key] ?? String(fallback), 10);
}

// ─── shared migration/seed paths ──────────────────────────────────────────────

const migrations: Knex.MigratorConfig = {
    directory: path.join(__dirname, 'src/database/migrations'),
    // Knex will use this table to track which files have run.
    tableName: 'knex_migrations',
    // Tells Knex to load .ts files via tsx/ts-node at runtime.
    loadExtensions: ['.ts'],
    stub: path.join(__dirname, 'src/database/migrations/migration.stub.ts'),
};

const seeds: Knex.SeederConfig = {
    directory: path.join(__dirname, 'src/database/seeds'),
    loadExtensions: ['.ts'],
};

// ─── PostgreSQL (used for User, Otp, Token in split mode) ─────────────────────

// function pgConfig(): Knex.Config {
//     return {
//         client: process.env['PG_CLIENT'] ?? 'pg',
//         connection: {
//             host:     process.env['PG_HOST']     ?? 'localhost',
//             port:     getNum('PG_PORT', 5432),
//             database: process.env['PG_DATABASE'] ?? requireEnv('PG_DATABASE'),
//             user:     process.env['PG_USER'],
//             password: process.env['PG_PASSWORD'],
//             ssl:      process.env['PG_SSL'] === 'true'
//                 ? { rejectUnauthorized: false }
//                 : false,
//         },
//         pool: {
//             min: getNum('PG_POOL_MIN', 2),
//             max: getNum('PG_POOL_MAX', 10),
//         },
//         migrations,
//         seeds,
//     };
// }

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

// ─── Environment blocks ────────────────────────────────────────────────────────
//
// The Knex CLI picks the block matching --env <name> or NODE_ENV.
// Each block just picks the right driver config.
// If you're running single-DB mode (DB_MODE=single), point every environment
// at whichever driver you're using.

const config: Record<string, Knex.Config> = {
    // development: pgConfig(),
    // staging: pgConfig(),
    // production: pgConfig(),

    // Use SQLite in test so CI needs no running DB server.
    // Swap to pgConfig() if you run integration tests against a real Postgres.
    test: sqliteConfig(),

    // Convenience aliases for explicit --env flags
    // postgres: pgConfig(),
    mysql: mysqlConfig(),
    sqlite: sqliteConfig(),
};

export default config;
