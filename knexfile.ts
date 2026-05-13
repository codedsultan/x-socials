/**
 * @file knexfile.ts
 * @description Knex CLI configuration — used exclusively for migrations and seeds.
 *              This file is NOT part of the runtime adapter system (DbManager / KnexAdapter).
 *              It reads the same env vars used by DbConfig so there is a single source of
 *              truth for connection settings.
 *
 *  Usage
 *  ─────
 *  # Run migrations against the default connection
 *  pnpm knex migrate:latest
 *
 *  # Run migrations against a named connection
 *  pnpm knex migrate:latest --env postgres
 *  pnpm knex migrate:latest --env mysql
 *  pnpm knex migrate:latest --env sqlite
 *
 *  # Create a new migration
 *  pnpm knex migrate:make create_users_table --env postgres
 *
 *  # Rollback
 *  pnpm knex migrate:rollback --env postgres
 *
 *  Add to package.json scripts:
 *  "knex": "knex --knexfile knexfile.ts"
 *
 *  Knex CLI docs: https://knexjs.org/guide/migrations.html
 */

// import "dotenv/config";
import type { Knex } from "knex";
import dotenv from 'dotenv';

dotenv.config();
// ─── JWT bypass (same as the original) ────────────────────────────────────────
// The migration CLI doesn't need auth — stub JWT_SECRET so EnvConfig doesn't
// reject startup if it isn't set in the migration environment.
if (!process.env["JWT_SECRET"]) {
  process.env["JWT_SECRET"] = "migration-placeholder";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`knexfile :: Missing required env var: ${key}`);
  return val;
}

// function optionalEnv(key: string): string | undefined {
//   return process.env[key] || undefined;
// }

// Helper that doesn't throw but returns undefined
function getEnv(key: string): string | undefined {
  return process.env[key];
}


function poolConfig(): Knex.PoolConfig {
  return {
    min: Number(process.env["DB_POOL_MIN"] ?? 1),
    max: Number(process.env["DB_POOL_MAX"] ?? 5),
  };
}

// ─── Connection builders ──────────────────────────────────────────────────────

function postgresConfig(): Knex.Config {
  const client = (process.env["PG_CLIENT"] ?? "pg") as "pg" | "pg-native";

  return {
    client,
    connection: {
      host: requireEnv("PG_HOST"),
      port: Number(process.env["PG_PORT"] ?? 5432),
      database: requireEnv("PG_DATABASE"),
      user: requireEnv("PG_USER"),
      password: requireEnv("PG_PASSWORD"),
      ssl: process.env["PG_SSL"] === "true",
    },
    pool: poolConfig(),
    migrations: {
      tableName: "knex_migrations",
      directory: "./src/database/migrations/postgres",
      disableMigrationsListValidation: true,
      extension: "ts",
      loadExtensions: [".ts"],
    },
    seeds: {
      directory: "./src/database/seeds/postgres",
    },
  };
}

function mysqlConfig(): Knex.Config {
  const client = (process.env["MYSQL_CLIENT"] ?? "mysql2") as "mysql" | "mysql2";

  return {
    client,
    connection: {
      host: requireEnv("MYSQL_HOST"),
      port: Number(process.env["MYSQL_PORT"] ?? 3306),
      database: requireEnv("MYSQL_DATABASE"),
      user: requireEnv("MYSQL_USER"),
      password: requireEnv("MYSQL_PASSWORD"),
      ssl: process.env["MYSQL_SSL"] === "true" ? {} : undefined,
    },
    pool: poolConfig(),
    migrations: {
      tableName: "knex_migrations",
      directory: "./src/database/migrations/mysql",
      disableMigrationsListValidation: true,
      extension: "ts",
      loadExtensions: [".ts"],
    },
    seeds: {
      directory: "./src/database/seeds/mysql",
    },
  };
}

function sqliteConfig(): Knex.Config {
  const client = (process.env["SQLITE_CLIENT"] ?? "better-sqlite3") as
    | "sqlite3"
    | "better-sqlite3";

  return {
    client,
    connection: {
      // filename: requireEnv("SQLITE_FILENAME") || './dev.sqlite',
      filename: getEnv('SQLITE_FILENAME') || './dev.sqlite',
    },
    useNullAsDefault: true,
    pool: { min: 1, max: 1 }, // SQLite does not support concurrent connections
    migrations: {
      tableName: "knex_migrations",
      directory: "./src/database/migrations/sqlite",
      disableMigrationsListValidation: true,
      extension: "ts",
      loadExtensions: [".ts"],
    },
    seeds: {
      directory: "./src/database/seeds/sqlite",
    },
  };
}

// ─── Default connection (used when --env flag is omitted) ─────────────────────

function defaultConfig(): Knex.Config {
  const defaultDb = process.env["DEFAULT_DB"] ?? "postgres";

  switch (defaultDb) {
    case "postgres": return postgresConfig();
    case "mysql": return mysqlConfig();
    case "sqlite": return sqliteConfig();
    default:
      throw new Error(
        `knexfile :: DEFAULT_DB="${defaultDb}" is not a supported relational driver. ` +
        `Supported values: postgres | mysql | sqlite. ` +
        `MongoDB does not use Knex migrations.`
      );
  }
}

// ─── Named exports (one per relational connection) ───────────────────────────
//
// Each key maps to a --env value on the CLI:
//   pnpm knex migrate:latest --env postgres
//
// The "development" | "staging" | "production" keys are the standard
// Knex environment names — they all point to the same connection builders
// but you can diverge per-environment here if needed.

const config: Record<string, Knex.Config> = {
  // ── Standard Knex environment names ──
  development: defaultConfig(),
  staging: defaultConfig(),
  production: defaultConfig(),
  test: sqliteConfig(),   // Tests always use SQLite in-memory by default

  // ── Named connections (match DEFAULT_DB / PG_CONNECTION_NAME etc.) ──
  // postgres: postgresConfig(),
  // mysql: mysqlConfig(),
  // sqlite: sqliteConfig(),
};

export default config;
