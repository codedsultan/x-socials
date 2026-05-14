/**
 * @file src/config/db/AdapterFactory.ts
 * @description Factory that instantiates the correct IDbAdapter for a given
 *              config.  Adding support for a new driver means adding one
 *              case here — no other file changes (OCP).
 */

import type { IDbAdapter, IDbConnectionConfig } from "../../interfaces/core/database";
import { MongooseAdapter } from "./adapters/MongooseAdapter";
import { KnexAdapter } from "./adapters/KnexAdapter";

export class AdapterFactory {
  /**
   * Create the appropriate adapter for the supplied connection config.
   * @throws when the driver is not supported.
   */
  public static create(config: IDbConnectionConfig): IDbAdapter {
    switch (config.driver) {
      case "mongoose":
      case "mongodb":
        return new MongooseAdapter(config);

      case "pg":
      case "pg-native":
      case "mysql":
      case "mysql2":
      // case "sqlite3":
      case "better-sqlite3":
      case "knex":
        return new KnexAdapter(config);

      default: {
        // Exhaustive check — TypeScript will catch unhandled DbDriver values
        const _exhaustive: never = config.driver;
        throw new Error(
          `AdapterFactory :: Unsupported driver "${_exhaustive as string}"`
        );
      }
    }
  }
}
