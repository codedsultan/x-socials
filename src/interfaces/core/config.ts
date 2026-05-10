/**
 * Define EnvConfig interface
 */

export type Environment = "development" | "staging" | "production" | "test";

/**
 * Core environment configuration (required fields)
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

  // API
  API_PREFIX?: string;

  // CORS & logging
  CORS_ENABLED: boolean;
  LOG_DAYS?: number;

  // Auth
  JWT_SECRET?: string;
  JWT_EXPIRES_IN?: string;

  // Email
  SENDGRID_API_KEY?: string;
  SMTP_FROM?: string;

  // Cloudinary
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
}

/**
 * Firebase configuration interface
 */
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

/**
 * Extended config with helper methods
 */
export interface IEnvConfigWithHelpers extends IEnvConfig {
  isProduction(): boolean;
  isStaging(): boolean;
  isDevelopment(): boolean;
  isTest(): boolean;
  isServerMaintenance(): boolean;
  getApiUrl(): string;
}
