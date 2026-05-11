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

  /**
   * Which named connection is the default.
   * Maps to the DEFAULT_DB env var.  When omitted the first registered
   * connection is used.
   */
  DEFAULT_DB?: string;
  // DB_NAME?: string;
  // ── API ──
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