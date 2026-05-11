/**
 * @file src/config/db/index.ts
 * @description Public API for the database module.
 *              Import from here — never from internal files directly.
 *
 * @example
 *   import DbManager, { DbConfig, AdapterFactory } from "../config/db";
 */

export { default as DbManager } from "./DbManager";
export { DbRegistry } from "./DbRegistry";
export { DbResolver } from "./DbResolver";
export { AdapterFactory } from "./AdapterFactory";
export { DbConfig } from "./DbConfig";
export { MongooseAdapter } from "./adapters/MongooseAdapter";
export { KnexAdapter } from "./adapters/KnexAdapter";
export { KnexUtils } from "./KnexUtils";
export type { IKnexUtils, TimestampPrecision } from "./KnexUtils";

// Re-export interfaces so consumers don't need a second import path
export type {
  IDbAdapter,
  IDbRegistry,
  IDbResolver,
  IDbManager,
  IDbConnectionConfig,
  IModelDbBinding,
  DbConnectionName,
  DbDriver,
} from "../../interfaces/core/database";