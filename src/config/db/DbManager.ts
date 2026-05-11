/**
 * @file src/config/db/DbManager.ts
 * @description Singleton façade that owns the DbRegistry and DbResolver.
 *              This is the only surface the application (app/index.ts, models,
 *              repositories) should import from — all lower-level details are
 *              hidden behind IDbManager.
 *
 *              SOLID notes
 *              ───────────
 *              SRP  – orchestrates init/shutdown only; does not own adapter logic.
 *              OCP  – new drivers are added via AdapterFactory, not here.
 *              LSP  – any IDbRegistry / IDbResolver impl can be swapped in.
 *              ISP  – consumers import IDbManager, not the concrete class.
 *              DIP  – depends on IDbRegistry / IDbResolver interfaces.
 */

import type {
  IDbConnectionConfig,
  IDbManager,
  IDbRegistry,
  IDbResolver,
  DbConnectionName,
  IModelDbBinding,
} from "../../interfaces/core/database";
import { DbRegistry } from "./DbRegistry";
import { DbResolver } from "./DbResolver";
import { AdapterFactory } from "./AdapterFactory";
import Logger from "../../logger";

class DbManager implements IDbManager {
  private static _instance: DbManager | null = null;

  public readonly registry: IDbRegistry;
  public readonly resolver: IDbResolver;

  private _initialised = false;

  private constructor() {
    this.registry = new DbRegistry();
    this.resolver = new DbResolver(this.registry);
  }

  // ─── Singleton access ────────────────────────────────────────────────────

  public static getInstance(): DbManager {
    if (!DbManager._instance) {
      DbManager._instance = new DbManager();
    }
    return DbManager._instance;
  }

  /** Reset the singleton — useful in tests. */
  public static reset(): void {
    DbManager._instance = null;
  }

  // ─── IDbManager ──────────────────────────────────────────────────────────

  public async initialize(configs: IDbConnectionConfig[]): Promise<void> {
    if (this._initialised) {
      Logger.getInstance().warn("DbManager :: Already initialised — skipping");
      return;
    }

    if (configs.length === 0) {
      throw new Error("DbManager :: No database configurations provided");
    }

    // Validate exactly one default
    const defaults = configs.filter((c) => c.isDefault);
    if (defaults.length === 0) {
      Logger.getInstance().warn(
        "DbManager :: No connection marked as default — " +
        `using first config ("${configs[0]!.name}")`
      );
      configs[0]!.isDefault = true;
    }
    if (defaults.length > 1) {
      throw new Error(
        `DbManager :: Multiple default connections: ` +
        defaults.map((c) => `"${c.name}"`).join(", ")
      );
    }

    // Register all adapters
    for (const config of configs) {
      const adapter = AdapterFactory.create(config);
      (this.registry as DbRegistry).register(adapter);

      if (config.isDefault) {
        (this.registry as DbRegistry).setDefault(config.name);
      }
    }

    // Open all connections
    await this.registry.connectAll();

    this._initialised = true;
    Logger.getInstance().info(
      `DbManager :: Initialised ${configs.length} connection(s): ` +
      this.registry.list().join(", ")
    );
  }

  public async shutdown(): Promise<void> {
    await this.registry.disconnectAll();
    this._initialised = false;
    Logger.getInstance().info("DbManager :: Shut down");
  }

  public async healthCheck(): Promise<Record<DbConnectionName, boolean>> {
    return this.registry.healthCheck();
  }

  // ─── Convenience delegation ───────────────────────────────────────────────

  /**
   * Sugar: bind a model class name to a specific connection name.
   * Delegates to the resolver — avoids consumers importing DbResolver directly.
   */
  public bindModel(binding: IModelDbBinding): void {
    this.resolver.bind(binding);
  }

  /**
   * Sugar: resolve the adapter for a given model name.
   */
  public resolveForModel(modelName: string) {
    return this.resolver.resolveForModel(modelName);
  }
}

export default DbManager;
