/**
 * @file src/config/db/DbRegistry.ts
 * @description Concrete implementation of IDbRegistry.
 *              Maintains a map of named adapters and orchestrates
 *              connect / disconnect / health-check across all of them.
 *              Single Responsibility: it only manages adapter registration
 *              and lifecycle — it does not know about model bindings.
 */

import type {
  IDbAdapter,
  IDbRegistry,
  DbConnectionName,
} from "../../interfaces/core/database";
import Logger from "../../logger";

export class DbRegistry implements IDbRegistry {
  private readonly _adapters = new Map<DbConnectionName, IDbAdapter>();
  private _defaultName: DbConnectionName | null = null;

  // ─── IDbRegistry ─────────────────────────────────────────────────────────

  public register(adapter: IDbAdapter): void {
    if (this._adapters.has(adapter.name)) {
      throw new Error(
        `DbRegistry :: Adapter "${adapter.name}" is already registered`
      );
    }

    this._adapters.set(adapter.name, adapter);
    Logger.getInstance().info(
      `DbRegistry :: Registered adapter "${adapter.name}" (${adapter.driver})`
    );
  }

  public get(name: DbConnectionName): IDbAdapter {
    const adapter = this._adapters.get(name);
    if (!adapter) {
      throw new Error(
        `DbRegistry :: No adapter found for connection name "${name}". ` +
        `Available: ${this.list().join(", ") || "(none)"}`
      );
    }
    return adapter;
  }

  public getDefault(): IDbAdapter {
    if (!this._defaultName) {
      throw new Error(
        "DbRegistry :: No default connection has been set. " +
        "Mark one config entry with isDefault: true."
      );
    }
    return this.get(this._defaultName);
  }

  /** Called by DbManager after registration when config.isDefault is set. */
  public setDefault(name: DbConnectionName): void {
    if (!this._adapters.has(name)) {
      throw new Error(
        `DbRegistry :: Cannot set default — "${name}" is not registered`
      );
    }

    if (this._defaultName && this._defaultName !== name) {
      Logger.getInstance().warn(
        `DbRegistry :: Overwriting default connection from ` +
        `"${this._defaultName}" to "${name}"`
      );
    }

    this._defaultName = name;
    Logger.getInstance().info(`DbRegistry :: Default connection set to "${name}"`);
  }

  public async connectAll(): Promise<void> {
    const results = await Promise.allSettled(
      [...this._adapters.values()].map((a) => a.connect())
    );

    results.forEach((result, idx) => {
      const name = [...this._adapters.keys()][idx];
      if (result.status === "rejected") {
        Logger.getInstance().error(
          `DbRegistry :: Failed to connect "${name}": ${result.reason}`
        );
      }
    });
  }

  public async disconnectAll(): Promise<void> {
    await Promise.allSettled(
      [...this._adapters.values()].map((a) => a.disconnect())
    );
    Logger.getInstance().info("DbRegistry :: All connections closed");
  }

  public async healthCheck(): Promise<Record<DbConnectionName, boolean>> {
    const entries = await Promise.all(
      [...this._adapters.entries()].map(async ([name, adapter]) => {
        const ok = await adapter.ping();
        return [name, ok] as [DbConnectionName, boolean];
      })
    );
    return Object.fromEntries(entries);
  }

  public list(): DbConnectionName[] {
    return [...this._adapters.keys()];
  }
}
