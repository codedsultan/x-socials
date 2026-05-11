/**
 * @file src/config/db/DbResolver.ts
 * @description Resolves which IDbAdapter should serve a given model.
 *              Models are bound by name; unbound models fall back to the
 *              default adapter.  Depends on IDbRegistry — not on any concrete
 *              adapter (Dependency Inversion).
 */

import type {
  IDbAdapter,
  IDbRegistry,
  IDbResolver,
  IModelDbBinding,
} from "../../interfaces/core/database";
import Logger from "../../logger";

export class DbResolver implements IDbResolver {
  private readonly _bindings = new Map<string, string>();
  private readonly _registry: IDbRegistry;

  constructor(registry: IDbRegistry) {
    this._registry = registry;
  }

  // ─── IDbResolver ─────────────────────────────────────────────────────────

  public bind(binding: IModelDbBinding): void {
    const { modelName, connectionName } = binding;

    if (this._bindings.has(modelName)) {
      Logger.getInstance().warn(
        `DbResolver :: Overwriting binding for model "${modelName}": ` +
        `"${this._bindings.get(modelName)}" → "${connectionName}"`
      );
    }

    this._bindings.set(modelName, connectionName);
    Logger.getInstance().info(
      `DbResolver :: Bound model "${modelName}" → connection "${connectionName}"`
    );
  }

  public resolveForModel(modelName: string): IDbAdapter {
    const connectionName = this._bindings.get(modelName);

    if (connectionName) {
      Logger.getInstance().debug?.(
        `DbResolver :: Model "${modelName}" resolved to "${connectionName}"`
      );
      return this._registry.get(connectionName);
    }

    // Fall back to the default adapter
    Logger.getInstance().debug?.(
      `DbResolver :: Model "${modelName}" has no explicit binding — using default`
    );
    return this._registry.getDefault();
  }

  public listBindings(): IModelDbBinding[] {
    return [...this._bindings.entries()].map(([modelName, connectionName]) => ({
      modelName,
      connectionName,
    }));
  }
}
