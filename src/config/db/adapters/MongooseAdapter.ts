/**
 * @file src/config/db/adapters/MongooseAdapter.ts
 * @description Mongoose/MongoDB adapter.
 *              Implements IDbAdapter; all MongoDB-specific logic lives here
 *              so that changing the driver never touches other adapters (OCP).
 */

import mongoose, { type Connection } from "mongoose";
import type {
  IDbAdapter,
  IDbConnectionConfig,
  DbConnectionName,
  DbDriver,
} from "../../../interfaces/core/database";
import Logger from "../../../logger";

export class MongooseAdapter implements IDbAdapter {
  public readonly name: DbConnectionName;
  public readonly driver: DbDriver = "mongoose";

  private _connection: Connection | null = null;
  private _connected = false;
  private readonly _config: IDbConnectionConfig;

  constructor(config: IDbConnectionConfig) {
    this._config = config;
    this.name = config.name;
  }

  // ─── IDbConnectable ──────────────────────────────────────────────────────

  public async connect(): Promise<boolean> {
    if (this._connected && this._connection) {
      return true;
    }

    const uri = this._config.uri;
    if (!uri) {
      const msg = `MongooseAdapter [${this.name}] :: Missing URI in config`;
      Logger.getInstance().error(msg);
      throw new Error(msg);
    }

    try {
      await mongoose.connect(uri, {
        dbName: this._config.dbName,
        autoIndex: true,
        socketTimeoutMS: this._config.socketTimeoutMS ?? 30_000,
        serverSelectionTimeoutMS:
          this._config.serverSelectionTimeoutMS ?? 5_000,
      });

      this._connection = mongoose.connection;
      this._connected = true;

      Logger.getInstance().info(
        `Database :: MongooseAdapter [${this.name}] connected`
      );
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      Logger.getInstance().error(
        `Database :: MongooseAdapter [${this.name}] error: ${msg}`
      );
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this._connected) return;

    await mongoose.disconnect();
    this._connected = false;
    this._connection = null;

    Logger.getInstance().info(
      `Database :: MongooseAdapter [${this.name}] disconnected`
    );
  }

  // ─── IDbHealthCheckable ──────────────────────────────────────────────────

  public async ping(): Promise<boolean> {
    try {
      if (!this._connection) return false;
      // readyState 1 === connected
      return this._connection.readyState === 1;
    } catch {
      return false;
    }
  }

  public isConnected(): boolean {
    return this._connected;
  }

  // ─── IDbAdapter ──────────────────────────────────────────────────────────

  /** Returns the raw mongoose.Connection for advanced usage. */
  public getClient(): Connection | null {
    return this._connection;
  }
}
