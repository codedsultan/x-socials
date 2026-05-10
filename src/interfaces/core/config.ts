/**
 * Define EnvConfig interface
 */

export type Environment = 'development' | 'staging' | 'production' | 'test';

export interface IEnvConfig {
    PORT: number;
    NODE_ENV: Environment;
    SERVER_MAINTENANCE: boolean;
    API_BASE_URL: string;
    ENABLE_SWAGGER: boolean;
}

// Optional: Add environment-specific configurations
export interface IEnvConfigWithDefaults extends IEnvConfig {
    API_VERSION: string;
    CORS_ORIGIN: string[];
    RATE_LIMIT_WINDOW_MS: number;
    RATE_LIMIT_MAX_REQUESTS: number;
}

// Add helper methods to the config interface
export interface IEnvConfigWithHelpers extends IEnvConfig {
    isProduction(): boolean;
    isStaging(): boolean;
    isDevelopment(): boolean;
    isTest(): boolean;
    isServerMaintenance(): boolean;
    getApiUrl(): string;
}