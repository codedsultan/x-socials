/**
 * @file src/interfaces/core/database.ts
 * @description Core database interfaces.
 *              Follows Interface Segregation Principle — each interface has
 *              a single, focused responsibility so consumers only depend on
 *              what they actually use.
 */

// ─── Connection lifecycle ────────────────────────────────────────────────────

/**
 * Anything that can open and close a connection to a data store.
 */
export interface IDbConnectable {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
}

/**
 * Anything that can report its own health/readiness.
 */
export interface IDbHealthCheckable {
  ping(): Promise<boolean>;
  isConnected(): boolean;
}

// ─── Driver / client identity ────────────────────────────────────────────────

/**
 * Supported database drivers understood by the registry.
 * Extend this union as new adapters are added.
 */
export type DbDriver =
  | "mongodb"
  | "mongoose"
  | "pg"
  | "pg-native"
  | "mysql"
  | "mysql2"
  // | "sqlite3"
  | "better-sqlite3"
  | "knex"; // generic knex fallback

/**
 * Logical name used to look up a connection in the registry.
 * Typically matches a domain area (e.g. "users", "analytics", "default").
 */
export type DbConnectionName = string;

// ─── Configuration ───────────────────────────────────────────────────────────

/**
 * Pool configuration shared across relational adapters.
 */
export interface IDbPoolConfig {
  min?: number;
  max?: number;
  idleTimeoutMillis?: number;
  acquireTimeoutMillis?: number;
}

/**
 * SSL/TLS options for relational connections.
 */
export interface IDbSslConfig {
  rejectUnauthorized?: boolean;
  ca?: string;
  cert?: string;
  key?: string;
}

/**
 * Configuration for a single database connection.
 * Not every field applies to every driver; adapters pick what they need.
 */
export interface IDbConnectionConfig {
  /** Unique logical name for this connection (e.g. "default", "analytics"). */
  name: DbConnectionName;

  /** Database driver / client. */
  driver: DbDriver;

  // ── MongoDB / document stores ──
  uri?: string;
  dbName?: string;
  authSource?: string;
  socketTimeoutMS?: number;
  serverSelectionTimeoutMS?: number;

  // ── Relational stores ──
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | IDbSslConfig;
  filename?: string; // SQLite only

  // ── Pool ──
  pool?: IDbPoolConfig;

  /**
   * When true this connection is used as the fallback when a model has no
   * explicit binding. Only one connection may be marked as default.
   */
  isDefault?: boolean;
}

// ─── Adapter (SRP + OCP) ────────────────────────────────────────────────────

/**
 * A database adapter wraps a single driver and exposes a uniform surface.
 * Implementing IDbConnectable + IDbHealthCheckable keeps concerns separate.
 *
 * Open/Closed: new drivers are added by creating a new adapter class —
 * no existing code is changed.
 */
export interface IDbAdapter extends IDbConnectable, IDbHealthCheckable {
  /** Logical name this adapter was registered under. */
  readonly name: DbConnectionName;

  /** Driver this adapter wraps. */
  readonly driver: DbDriver;

  /**
   * Returns the raw native client/connection (mongoose.Connection, pg.Pool,
   * knex instance, …).  Typed as `unknown` so each adapter can narrow it.
   */
  getClient(): unknown;
}

// ─── Registry (Dependency Inversion) ────────────────────────────────────────

/**
 * Central registry that manages multiple named database adapters.
 * Higher-level code (services, models) depends on this interface, not on
 * any concrete registry class.
 */
export interface IDbRegistry {
  /**
   * Register an adapter.
   * @throws if another adapter with the same name is already registered.
   */
  register(adapter: IDbAdapter): void;

  /**
   * Retrieve a registered adapter by name.
   * @throws if no adapter is found for the given name.
   */
  get(name: DbConnectionName): IDbAdapter;

  /**
   * Retrieve the default adapter (the one with `isDefault: true`).
   * @throws if no default has been set.
   */
  getDefault(): IDbAdapter;

  /** Open connections on all registered adapters. */
  connectAll(): Promise<void>;

  /** Close connections on all registered adapters. */
  disconnectAll(): Promise<void>;

  /** Return health status for every adapter. */
  healthCheck(): Promise<Record<DbConnectionName, boolean>>;

  /** List all registered connection names. */
  list(): DbConnectionName[];
}

// ─── Model-to-DB binding (DIP) ───────────────────────────────────────────────

/**
 * Associates a model/entity class name with a specific connection name.
 * Allows per-model DB routing without coupling models to concrete adapters.
 */
export interface IModelDbBinding {
  /** Model class name, e.g. "UserModel", "PostModel". */
  modelName: string;
  /** Connection name to use for this model. */
  connectionName: DbConnectionName;
}

/**
 * Resolves the correct connection for a given model.
 * Consumed by repository base classes or ORM helpers.
 */
export interface IDbResolver {
  /**
   * Resolve the adapter that should serve the given model.
   * Falls back to the default adapter when no explicit binding exists.
   */
  resolveForModel(modelName: string): IDbAdapter;

  /** Register a model→connection binding. */
  bind(binding: IModelDbBinding): void;

  /** List all registered bindings. */
  listBindings(): IModelDbBinding[];
}

// ─── Manager (facade) ────────────────────────────────────────────────────────

/**
 * High-level façade that owns the registry and the resolver together.
 * This is the single entry point the rest of the application should use.
 */
export interface IDbManager {
  readonly registry: IDbRegistry;
  readonly resolver: IDbResolver;

  /** Initialise all connections from config. */
  initialize(configs: IDbConnectionConfig[]): Promise<void>;

  /** Gracefully close all connections. */
  shutdown(): Promise<void>;

  /** Per-adapter health report. */
  healthCheck(): Promise<Record<DbConnectionName, boolean>>;
}


