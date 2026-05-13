/**
 * @file src/interfaces/core/config.ts
 * @description Core configuration interfaces.
 *              Database connection config has been moved to
 *              src/interfaces/core/database.ts — IEnvConfig now only holds
 *              the generic app-level DB env vars (legacy support).
 */

// ─── Environment ─────────────────────────────────────────────────────────────

export type Environment = "development" | "staging" | "production" | "test";

// ─── Application env config ──────────────────────────────────────────────────

/**
 * Core environment configuration (required fields).
 *
 * Database connections are configured via the DB_* / MONGO_URI / PG_* /
 * MYSQL_* / SQLITE_* env vars read by DbConfig.buildAll().
 * See src/interfaces/core/database.ts for the full connection shape.
 */
export interface IEnvConfig {
  PORT: number;
  NODE_ENV: Environment;
  SERVER_MAINTENANCE: boolean;
  API_BASE_URL: string;
  ENABLE_SWAGGER: boolean;

  // Database (optional — populated when DB is configured)
  MONGO_URI?: string;
  DB_NAME?: string;
  MONGO_DB_NAME?: string;  // Added for consistency
  MONGO_SOCKET_TIMEOUT_MS?: string;
  MONGO_SERVER_SELECTION_TIMEOUT_MS?: string;

  // PostgreSQL
  PG_HOST?: string;
  PG_PORT?: string;
  PG_DATABASE?: string;
  PG_USER?: string;
  PG_PASSWORD?: string;
  PG_SSL?: string;
  PG_CLIENT?: string;
  PG_POOL_MIN?: string;
  PG_POOL_MAX?: string;

  // MySQL
  MYSQL_HOST?: string;
  MYSQL_PORT?: string;
  MYSQL_DATABASE?: string;
  MYSQL_USER?: string;
  MYSQL_PASSWORD?: string;
  MYSQL_CLIENT?: string;

  // SQLite
  SQLITE_FILENAME?: string;
  SQLITE_CLIENT?: string;

  // Database general
  DEFAULT_DB?: string;

  // API
  API_PREFIX?: string;

  // ── CORS & logging ──
  CORS_ENABLED: boolean;
  LOG_DAYS?: number;

  // ── Auth ──
  JWT_SECRET?: string;
  JWT_EXPIRES_IN?: string;

  // ── Email ──
  SENDGRID_API_KEY?: string;
  SMTP_FROM?: string;

  // ── Cloudinary ──
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
}

// ─── Firebase ────────────────────────────────────────────────────────────────

export interface IFirebaseConfig {
  FIREBASE_TYPE?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_PRIVATE_KEY_ID?: string;
  FIREBASE_PRIVATE_KEY?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_CLIENT_ID?: string;
  FIREBASE_AUTH_URI?: string;
  FIREBASE_TOKEN_URI?: string;
  FIREBASE_AUTH_PROVIDER_X509_CERT_URL?: string;
  FIREBASE_CLIENT_X509_CERT_URL?: string;
}

// ─── Extended config with helper methods ─────────────────────────────────────

export interface IEnvConfigWithHelpers extends IEnvConfig {
  isProduction(): boolean;
  isStaging(): boolean;
  isDevelopment(): boolean;
  isTest(): boolean;
  isServerMaintenance(): boolean;
  getApiUrl(): string;
}

// New interfaces for internal use (not breaking changes)
export interface IMongoDbConfig {
  uri: string;
  dbName: string;
  socketTimeoutMS: number;
  serverSelectionTimeoutMS: number;
}

export interface IPostgresConfig {
  host: string;
  port: number;
  database: string;
  user?: string;
  password?: string;
  ssl: boolean;
  client: string;
  poolMin: number;
  poolMax: number;
}

export interface IMysqlConfig {
  host: string;
  port: number;
  database: string;
  user?: string;
  password?: string;
  client: string;
  poolMin: number;
  poolMax: number;
}

export interface ISqliteConfig {
  filename: string;
  client: string;
  poolMin: number;
  poolMax: number;
}

export interface IDatabaseConfig {
  mongodb?: IMongoDbConfig;
  postgres?: IPostgresConfig;
  mysql?: IMysqlConfig;
  sqlite?: ISqliteConfig;
  defaultDb: string;
  /** 'split' = per-model routing (default) | 'single' = all models on defaultDb */
  dbMode?: 'split' | 'single';
}

export interface IAppConfig {
  server: IEnvConfig;  // Reuse existing IEnvConfig
  databases: IDatabaseConfig;
}