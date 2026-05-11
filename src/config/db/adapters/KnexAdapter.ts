/**
 * @file src/config/db/adapters/KnexAdapter.ts
 * @description Knex adapter supporting PostgreSQL, MySQL, and SQLite.
 *              One adapter class covers all relational drivers — the specific
 *              driver is injected via config, keeping the class open for new
 *              dialects without modification (OCP).
 */

import knex, { type Knex } from "knex";
import { KnexUtils, type IKnexUtils, type TimestampPrecision } from "../KnexUtils";
import type {
  IDbAdapter,
  IDbConnectionConfig,
  DbConnectionName,
  DbDriver,
} from "../../../interfaces/core/database";
import Logger from "../../../logger";

export class KnexAdapter implements IDbAdapter {
  public readonly name: DbConnectionName;
  public readonly driver: DbDriver;

  private _client: Knex | null = null;
  private _connected = false;
  private readonly _config: IDbConnectionConfig;

  constructor(config: IDbConnectionConfig) {
    this._config = config;
    this.name = config.name;
    this.driver = config.driver;
  }

  // ─── IDbConnectable ──────────────────────────────────────────────────────

  // public async connect(): Promise<boolean> {
  //   if (this._connected && this._client) {
  //     return true;
  //   }

  //   try {
  //     const isSQLite =
  //       this._config.driver === "sqlite3" ||
  //       this._config.driver === "better-sqlite3";

  //     this._client = knex({
  //       client: this._config.driver,
  //       connection: {
  //         ...(isSQLite
  //           ? { filename: this._config.filename }
  //           : {
  //             host: this._config.host,
  //             port: this._config.port,
  //             database: this._config.database,
  //             user: this._config.user,
  //             password: this._config.password,
  //             ssl: this._config.ssl,
  //           }),
  //       },
  //       pool: {
  //         min: this._config.pool?.min ?? 2,
  //         max: this._config.pool?.max ?? 10,
  //       },
  //       useNullAsDefault: isSQLite,
  //     });

  //     // Verify the connection is reachable
  //     await this._client.raw("SELECT 1");
  //     this._connected = true;

  //     Logger.getInstance().info(
  //       `Database :: KnexAdapter [${this.name}] (${this._config.driver}) connected`
  //     );
  //     return true;
  //   } catch (error: unknown) {
  //     const msg = error instanceof Error ? error.message : String(error);
  //     Logger.getInstance().error(
  //       `Database :: KnexAdapter [${this.name}] error: ${msg}`
  //     );
  //     return false;
  //   }
  // }

  public async connect(): Promise<boolean> {
    if (this._connected && this._client) {
      return true;
    }

    try {
      const isSQLite =
        this._config.driver === "sqlite3" ||
        this._config.driver === "better-sqlite3";

      // Build connection config with proper type narrowing
      const connectionConfig = isSQLite
        ? { filename: this._config.filename as string }
        : {
          host: this._config.host as string,
          port: this._config.port as number,
          database: this._config.database as string,
          user: this._config.user as string,
          password: this._config.password as string,
          ssl: this._config.ssl as boolean | undefined,
        };

      this._client = knex({
        client: this._config.driver,
        connection: connectionConfig,
        pool: {
          min: this._config.pool?.min ?? 2,
          max: this._config.pool?.max ?? 10,
        },
        useNullAsDefault: isSQLite,
      });

      // Verify the connection is reachable
      await this._client.raw("SELECT 1");
      this._connected = true;

      Logger.getInstance().info(
        `Database :: KnexAdapter [${this.name}] (${this._config.driver}) connected`
      );
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      Logger.getInstance().error(
        `Database :: KnexAdapter [${this.name}] error: ${msg}`
      );
      return false;
    }
  }
  public async disconnect(): Promise<void> {
    if (!this._client) return;

    await this._client.destroy();
    this._client = null;
    this._connected = false;

    Logger.getInstance().info(
      `Database :: KnexAdapter [${this.name}] disconnected`
    );
  }

  // ─── IDbHealthCheckable ──────────────────────────────────────────────────

  public async ping(): Promise<boolean> {
    try {
      if (!this._client) return false;
      await this._client.raw("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  public isConnected(): boolean {
    return this._connected;
  }

  // ─── IDbAdapter ──────────────────────────────────────────────────────────

  /** Returns the raw Knex instance for query building. */
  public getClient(): Knex | null {
    return this._client;
  }

  // ─── Knex-specific helpers ────────────────────────────────────────────────

  public get isPostgres(): boolean {
    return (
      this._config.driver === "pg" || this._config.driver === "pg-native"
    );
  }

  public get isMySQL(): boolean {
    return (
      this._config.driver === "mysql" || this._config.driver === "mysql2"
    );
  }

  public get isSQLite(): boolean {
    return (
      this._config.driver === "sqlite3" ||
      this._config.driver === "better-sqlite3"
    );
  }

  /**
   * Returns the appropriate case-insensitive LIKE method name for knex
   * query builder calls.
   */
  public get compatibleILIKE(): "andWhereILike" | "andWhereLike" {
    return this.isPostgres ? "andWhereILike" : "andWhereLike";
  }

  /**
   * Returns a KnexUtils instance scoped to this adapter's live client.
   *
   * @throws if called before connect()
   *
   * @example
   *   const expr = adapter.utils.truncatedTimestamp("created_at", "hour");
   *   await adapter.getClient()!("events").select(expr.as("bucket")).count("* as total");
   */
  public get utils(): IKnexUtils {
    if (!this._client) {
      throw new Error(
        `KnexAdapter [${this.name}] :: utils accessed before connect()`
      );
    }
    return new KnexUtils(this._client);
  }

  /**
   * Convenience passthrough — truncates a timestamp column to the given
   * precision using the dialect of this adapter's driver.
   *
   * @see KnexUtils.truncatedTimestamp
   */
  public truncatedTimestamp(
    columnName: string,
    precision: TimestampPrecision = "hour"
  ): Knex.Raw {
    return this.utils.truncatedTimestamp(columnName, precision);
  }
}
