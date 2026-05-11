/**
 * @file src/config/db/DbConfig.ts
 * @description Reads environment variables and produces the
 *              IDbConnectionConfig[] array consumed by DbManager.initialize().
 *
 *              Add a new connection by adding a new static builder method
 *              and calling it from buildAll() — no other file changes needed.
 */

import type {
  IDbConnectionConfig,
  DbDriver,
} from "../../interfaces/core/database";
import Logger from "../../logger";

export class DbConfig {
  /**
   * Build configuration objects for all database connections defined in the
   * environment.  Only connections whose required env vars are present are
   * included — missing entries are skipped with a warning.
   */
  public static buildAll(): IDbConnectionConfig[] {
    const configs: IDbConnectionConfig[] = [];

    const mongo = DbConfig._buildMongo();
    if (mongo) configs.push(mongo);

    const postgres = DbConfig._buildPostgres();
    if (postgres) configs.push(postgres);

    const mysql = DbConfig._buildMySQL();
    if (mysql) configs.push(mysql);

    const sqlite = DbConfig._buildSQLite();
    if (sqlite) configs.push(sqlite);

    // If no configs produced, app cannot start
    if (configs.length === 0) {
      throw new Error(
        "DbConfig :: No database configuration found in environment variables. " +
        "Set at least one set of DB_* / MONGO_URI env vars."
      );
    }

    return configs;
  }

  // ─── Per-driver builders ─────────────────────────────────────────────────

  private static _buildMongo(): IDbConnectionConfig | null {
    const uri = process.env["MONGO_URI"];
    if (!uri) return null;

    Logger.getInstance().info("DbConfig :: Found MongoDB configuration");

    return {
      name: process.env["MONGO_CONNECTION_NAME"] ?? "mongodb",
      driver: "mongoose" as DbDriver,
      uri,
      dbName: process.env["MONGO_DB_NAME"] ?? process.env["DB_NAME"],
      socketTimeoutMS: Number(process.env["MONGO_SOCKET_TIMEOUT_MS"] ?? 30_000),
      serverSelectionTimeoutMS: Number(
        process.env["MONGO_SERVER_SELECTION_TIMEOUT_MS"] ?? 5_000
      ),
      isDefault: process.env["DEFAULT_DB"] === "mongodb" ||
        !process.env["DEFAULT_DB"],
    };
  }

  private static _buildPostgres(): IDbConnectionConfig | null {
    const host = process.env["PG_HOST"] ?? process.env["DB_HOST"];
    const driver =
      (process.env["PG_CLIENT"] as DbDriver | undefined) ?? "pg";

    if (!host || !["pg", "pg-native"].includes(driver)) return null;

    Logger.getInstance().info("DbConfig :: Found PostgreSQL configuration");

    return {
      name: process.env["PG_CONNECTION_NAME"] ?? "postgres",
      driver,
      host,
      port: Number(process.env["PG_PORT"] ?? process.env["DB_PORT"] ?? 5432),
      database:
        process.env["PG_DATABASE"] ??
        process.env["DB_NAME"] ??
        "postgres",
      user: process.env["PG_USER"] ?? process.env["DB_USER"],
      password: process.env["PG_PASSWORD"] ?? process.env["DB_PASSWORD"],
      ssl: process.env["PG_SSL"] === "true",
      pool: {
        min: Number(process.env["PG_POOL_MIN"] ?? process.env["DB_POOL_MIN"] ?? 2),
        max: Number(process.env["PG_POOL_MAX"] ?? process.env["DB_POOL_MAX"] ?? 10),
      },
      isDefault: process.env["DEFAULT_DB"] === "postgres",
    };
  }

  private static _buildMySQL(): IDbConnectionConfig | null {
    const host = process.env["MYSQL_HOST"] ?? process.env["DB_HOST"];
    const driver =
      (process.env["MYSQL_CLIENT"] as DbDriver | undefined) ?? "mysql2";

    if (!host || !["mysql", "mysql2"].includes(driver)) return null;

    Logger.getInstance().info("DbConfig :: Found MySQL configuration");

    return {
      name: process.env["MYSQL_CONNECTION_NAME"] ?? "mysql",
      driver,
      host,
      port: Number(process.env["MYSQL_PORT"] ?? process.env["DB_PORT"] ?? 3306),
      database:
        process.env["MYSQL_DATABASE"] ?? process.env["DB_NAME"],
      user: process.env["MYSQL_USER"] ?? process.env["DB_USER"],
      password: process.env["MYSQL_PASSWORD"] ?? process.env["DB_PASSWORD"],
      ssl: process.env["MYSQL_SSL"] === "true",
      pool: {
        min: Number(process.env["MYSQL_POOL_MIN"] ?? process.env["DB_POOL_MIN"] ?? 2),
        max: Number(process.env["MYSQL_POOL_MAX"] ?? process.env["DB_POOL_MAX"] ?? 10),
      },
      isDefault: process.env["DEFAULT_DB"] === "mysql",
    };
  }

  private static _buildSQLite(): IDbConnectionConfig | null {
    const filename = process.env["SQLITE_FILENAME"] ?? process.env["DB_FILENAME"];
    if (!filename) return null;

    const driver =
      (process.env["SQLITE_CLIENT"] as DbDriver | undefined) ?? "better-sqlite3";

    Logger.getInstance().info("DbConfig :: Found SQLite configuration");

    return {
      name: process.env["SQLITE_CONNECTION_NAME"] ?? "sqlite",
      driver,
      filename,
      isDefault: process.env["DEFAULT_DB"] === "sqlite",
    };
  }
}
