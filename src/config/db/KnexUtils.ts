/**
 * @file src/config/db/KnexUtils.ts
 * @description Cross-dialect Knex utility helpers.
 *
 *              KnexUtils wraps a live Knex instance and exposes SQL fragments
 *              that differ across database engines.  Pass the instance from
 *              KnexAdapter.getClient() or inject it directly in tests.
 *
 *              Supported drivers: pg | pg-native | mysql | mysql2 | sqlite3 | better-sqlite3
 *
 *              Usage
 *              ─────
 *              const utils = new KnexUtils(adapter.getClient()!);
 *              const expr  = utils.truncatedTimestamp("created_at", "hour");
 *              await knex("events").select(expr.as("bucket")).count("* as total");
 */

import type { Knex } from "knex";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Granularity levels supported by truncatedTimestamp across all dialects.
 */
export type TimestampPrecision = "second" | "minute" | "hour" | "day";

/**
 * Knex driver names as reported by knex.client.driverName at runtime.
 * Kept separate from DbDriver so KnexUtils stays independent of the
 * registry layer and can be used with a raw Knex instance.
 */
type KnexDriverName =
  | "pg"
  | "pg-native"
  | "sqlite3"
  | "better-sqlite3"
  | "mysql"
  | "mysql2";

// ─── Format maps (const so TypeScript narrows the index type) ─────────────────

const SQLITE_FORMATS: Record<TimestampPrecision, string> = {
  second: "%Y-%m-%d %H:%M:%S",
  minute: "%Y-%m-%d %H:%M:00",
  hour:   "%Y-%m-%d %H:00:00",
  day:    "%Y-%m-%d 00:00:00",
};

const MYSQL_FORMATS: Record<TimestampPrecision, string> = {
  second: "%Y-%m-%d %H:%i:%s",
  minute: "%Y-%m-%d %H:%i:00",
  hour:   "%Y-%m-%d %H:00:00",
  day:    "%Y-%m-%d 00:00:00",
};

// ─── Interface ────────────────────────────────────────────────────────────────

/**
 * Public surface of KnexUtils — depend on this interface, not the class.
 */
export interface IKnexUtils {
  /**
   * Returns a raw Knex SQL fragment that truncates a timestamp column to the
   * requested precision in a dialect-safe way.
   *
   * @param columnName  Unquoted column reference, e.g. "created_at" or "e.created_at"
   * @param precision   Granularity: "second" | "minute" | "hour" (default) | "day"
   *
   * @example
   *   const expr = utils.truncatedTimestamp("created_at", "hour");
   *   await knex("events").select(expr.as("bucket")).count("* as total").groupBy("bucket");
   */
  truncatedTimestamp(columnName: string, precision?: TimestampPrecision): Knex.Raw;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class KnexUtils implements IKnexUtils {
  private readonly _knex: Knex;

  /**
   * @param knex  A connected Knex instance, e.g. from KnexAdapter.getClient()
   */
  constructor(knex: Knex) {
    this._knex = knex;
  }

  /**
   * Returns a dialect-specific SQL fragment that truncates a timestamp column
   * to the given precision.
   *
   * Dialect matrix
   * ──────────────
   * pg / pg-native    → date_trunc(?precision, column AT TIME ZONE 'UTC')
   * mysql / mysql2    → DATE_FORMAT(column, ?format)
   * sqlite3 / b-s3    → strftime(?format, column)
   *
   * @throws {Error} for unsupported driver names
   */
  public truncatedTimestamp(
    columnName: string,
    precision: TimestampPrecision = "hour"
  ): Knex.Raw {
    // knex.client.driverName reflects the actual runtime driver string
    const driver = (this._knex.client as { driverName?: string })
      .driverName as KnexDriverName | undefined;

    switch (driver) {
      case "pg":
      case "pg-native":
        // date_trunc keeps the result as a timestamptz in UTC
        return this._knex.raw(
          `date_trunc(?, ?? at time zone 'UTC')`,
          [precision, columnName]
        );

      case "mysql":
      case "mysql2": {
        const fmt = MYSQL_FORMATS[precision];
        // DATE_FORMAT returns a string — cast back to DATETIME for type consistency
        return this._knex.raw(
          `CAST(DATE_FORMAT(??, ?) AS DATETIME)`,
          [columnName, fmt]
        );
      }

      case "sqlite3":
      case "better-sqlite3": {
        const fmt = SQLITE_FORMATS[precision];
        return this._knex.raw(`strftime(?, ??)`, [fmt, columnName]);
      }

      default:
        throw new Error(
          `KnexUtils :: truncatedTimestamp is not supported for driver "${driver ?? "unknown"}". ` +
          `Supported drivers: pg, pg-native, mysql, mysql2, sqlite3, better-sqlite3.`
        );
    }
  }
}
