import type { Application } from "express";
import type { IEnvConfig, Environment } from "../interfaces/core/config";
import Logger from "../logger";

class EnvConfig {
    private static instance: EnvConfig | null = null;
    private config: IEnvConfig | null = null;
    private configLoadedAt: Date | null = null;
    private readonly isProduction: boolean;
    private readonly isTest: boolean;

    private constructor() {
        // Detect environment once at startup
        this.isProduction = process.env.NODE_ENV === "production";
        this.isTest = process.env.NODE_ENV === "test";
    }

    public static getInstance(): EnvConfig {
        if (!EnvConfig.instance) {
            EnvConfig.instance = new EnvConfig();
        }
        return EnvConfig.instance;
    }

    /**
     * Returns the complete config object (backward compatible)
     * In production, this caches the config for performance
     */
    public static getConfig(): IEnvConfig {
        return EnvConfig.getInstance().loadConfig();
    }

    /**
     * Instance method to get config
     */
    public getConfig(): IEnvConfig {
        return this.loadConfig();
    }

    private loadConfig(): IEnvConfig {
        // Cache config in production for performance
        if (this.isProduction && this.config && !this.isTest) {
            return this.config;
        }

        // In development/test, always reload to pick up changes
        const nodeEnv = this.getNodeEnv();
        const port = this.getPort();

        // Validate in production (skip validation in tests)
        if (this.isProduction && !this.isTest) {
            this.validateProductionConfig(nodeEnv, port);
        }

        const config = this.buildConfig(nodeEnv, port);

        // Cache in production (but not in tests)
        if (this.isProduction && !this.isTest) {
            this.config = config;
            this.configLoadedAt = new Date();
        }

        // Log only once in production, or always in development (skip in tests)
        if ((!this.isProduction || !this.configLoadedAt) && !this.isTest) {
            this.logConfig(config);
        }

        return config;
    }

    private getNodeEnv(): Environment {
        const env = process.env["NODE_ENV"] as Environment;

        // In production, NODE_ENV must be explicitly set
        if (this.isProduction && !this.isTest && !env) {
            throw new Error("NODE_ENV must be set in production environment");
        }

        const nodeEnv = env || "development";
        const validEnvs: Environment[] = ["development", "staging", "production", "test"];

        if (!validEnvs.includes(nodeEnv)) {
            throw new Error(`Invalid NODE_ENV: ${nodeEnv}. Must be one of: ${validEnvs.join(", ")}`);
        }

        return nodeEnv;
    }

    private getPort(): number {
        const portEnv = process.env["PORT"];

        // In production, PORT is required
        if (this.isProduction && !this.isTest && !portEnv) {
            throw new Error("PORT must be set in production environment");
        }

        if (portEnv === undefined || portEnv === "") {
            return 4000; // Default for development
        }

        const port = parseInt(portEnv, 10);

        if (isNaN(port)) {
            if (this.isProduction && !this.isTest) {
                throw new Error(`Invalid PORT number: ${portEnv}. Must be a valid number in production`);
            }
            return 4000; // Fallback to default in development
        }

        if (port < 0 || port > 65535) {
            throw new Error(`Invalid PORT number: ${port}. Must be between 0 and 65535.`);
        }

        return port;
    }

    private buildConfig(nodeEnv: Environment, port: number): IEnvConfig {
        return {
            PORT: port,
            NODE_ENV: nodeEnv,
            SERVER_MAINTENANCE: this.getServerMaintenance(),
            API_BASE_URL: this.getApiBaseUrl(),
            ENABLE_SWAGGER: this.getSwaggerEnabled(nodeEnv),
            CORS_ENABLED: this.getCorsEnabled(),

            // Database configs (optional, validated elsewhere)
            MONGO_URI: process.env["MONGO_URI"],
            MONGO_DB_NAME: process.env["MONGO_DB_NAME"],
            DB_NAME: process.env["DB_NAME"],
            MONGO_SOCKET_TIMEOUT_MS: process.env["MONGO_SOCKET_TIMEOUT_MS"],
            MONGO_SERVER_SELECTION_TIMEOUT_MS: process.env["MONGO_SERVER_SELECTION_TIMEOUT_MS"],

            PG_HOST: process.env["PG_HOST"],
            PG_PORT: process.env["PG_PORT"],
            PG_DATABASE: process.env["PG_DATABASE"],
            PG_USER: process.env["PG_USER"],
            PG_PASSWORD: process.env["PG_PASSWORD"],
            PG_SSL: process.env["PG_SSL"],
            PG_CLIENT: process.env["PG_CLIENT"],
            PG_POOL_MIN: process.env["PG_POOL_MIN"],
            PG_POOL_MAX: process.env["PG_POOL_MAX"],

            MYSQL_HOST: process.env["MYSQL_HOST"],
            MYSQL_PORT: process.env["MYSQL_PORT"],
            MYSQL_DATABASE: process.env["MYSQL_DATABASE"],
            MYSQL_USER: process.env["MYSQL_USER"],
            MYSQL_PASSWORD: process.env["MYSQL_PASSWORD"],
            MYSQL_CLIENT: process.env["MYSQL_CLIENT"],

            SQLITE_FILENAME: process.env["SQLITE_FILENAME"],
            SQLITE_CLIENT: process.env["SQLITE_CLIENT"],

            DEFAULT_DB: process.env["DEFAULT_DB"] || "mongodb",

            API_PREFIX: process.env["API_PREFIX"] || "/api",
            LOG_DAYS: this.getLogDays(),
            JWT_SECRET: this.getRequiredEnvVar("JWT_SECRET", this.isProduction && !this.isTest),
            JWT_EXPIRES_IN: process.env["JWT_EXPIRES_IN"] || "7d",
            SENDGRID_API_KEY: process.env["SENDGRID_API_KEY"],
            SMTP_FROM: process.env["SMTP_FROM"],
            CLOUDINARY_CLOUD_NAME: process.env["CLOUDINARY_CLOUD_NAME"],
            CLOUDINARY_API_KEY: process.env["CLOUDINARY_API_KEY"],
            CLOUDINARY_API_SECRET: process.env["CLOUDINARY_API_SECRET"],
        };
    }

    private getRequiredEnvVar(key: string, required: boolean): string | undefined {
        const value = process.env[key];
        if (required && !value) {
            throw new Error(`Required environment variable ${key} is missing in production`);
        }
        return value;
    }

    private getServerMaintenance(): boolean {
        return process.env["SERVER_MAINTENANCE"] === "true";
    }

    private getApiBaseUrl(): string {
        const baseUrl = process.env["API_BASE_URL"];
        if (this.isProduction && !this.isTest && !baseUrl) {
            throw new Error("API_BASE_URL must be set in production");
        }
        return baseUrl || "http://localhost:5000";
    }

    private getSwaggerEnabled(nodeEnv: Environment): boolean {
        const explicitValue = process.env["ENABLE_SWAGGER"];

        if (explicitValue !== undefined) {
            return explicitValue === "true";
        }

        // Sensible defaults
        if (nodeEnv === "production") return false;
        if (nodeEnv === "staging") return true;
        return true;
    }

    private getCorsEnabled(): boolean {
        return process.env["CORS_ENABLED"] !== "false";
    }

    private getLogDays(): number | undefined {
        const logDays = process.env["LOG_DAYS"];
        if (!logDays) return undefined;

        const days = parseInt(logDays, 10);
        if (isNaN(days)) return undefined;

        // Validate reasonable range for production (skip in tests)
        if (this.isProduction && !this.isTest && (days < 1 || days > 90)) {
            throw new Error(`LOG_DAYS must be between 1 and 90 in production, got: ${days}`);
        }

        return days;
    }

    private validateProductionConfig(nodeEnv: Environment, port: number): void {
        const requiredProdVars = [
            "JWT_SECRET",
            "API_BASE_URL"
        ];

        const missingVars = requiredProdVars.filter(key => !process.env[key]);

        if (missingVars.length > 0) {
            throw new Error(`Missing required production environment variables: ${missingVars.join(", ")}`);
        }

        // Validate JWT_SECRET strength in production
        const jwtSecret = process.env["JWT_SECRET"];
        if (jwtSecret && jwtSecret.length < 32) {
            throw new Error("JWT_SECRET must be at least 32 characters in production");
        }

        // Ensure at least one database is configured in production
        const hasDatabase = !!(
            process.env["MONGO_URI"] ||
            (process.env["PG_HOST"] && process.env["PG_DATABASE"]) ||
            (process.env["MYSQL_HOST"] && process.env["MYSQL_DATABASE"]) ||
            process.env["SQLITE_FILENAME"]
        );

        if (!hasDatabase) {
            throw new Error("At least one database must be configured in production");
        }
    }

    private logConfig(config: IEnvConfig): void {
        const logger = Logger.getInstance();

        // Create a safe copy for logging (hide sensitive data)
        const safeConfig = { ...config };
        if (safeConfig.JWT_SECRET) {
            safeConfig.JWT_SECRET = "***";
        }
        if (safeConfig.SENDGRID_API_KEY) {
            safeConfig.SENDGRID_API_KEY = "***";
        }
        if (safeConfig.CLOUDINARY_API_SECRET) {
            safeConfig.CLOUDINARY_API_SECRET = "***";
        }
        if (safeConfig.PG_PASSWORD) {
            safeConfig.PG_PASSWORD = "***";
        }
        if (safeConfig.MYSQL_PASSWORD) {
            safeConfig.MYSQL_PASSWORD = "***";
        }

        if (config.NODE_ENV === "staging") {
            logger.warn("Running in STAGING mode");
        }

        if (config.PORT === 0) {
            logger.info("Using dynamic port (OS will assign available port)");
        }

        if (config.NODE_ENV === "production" && config.ENABLE_SWAGGER) {
            logger.warn("Swagger is enabled in production - recommended to disable");
        }

        // Log database configuration status (without exposing credentials)
        const databases = [];
        if (config.MONGO_URI) databases.push("MongoDB");
        if (config.PG_HOST && config.PG_DATABASE) databases.push("PostgreSQL");
        if (config.MYSQL_HOST && config.MYSQL_DATABASE) databases.push("MySQL");
        if (config.SQLITE_FILENAME) databases.push("SQLite");

        logger.info(`Configuration loaded (${config.NODE_ENV} mode)`);
        logger.info(`Databases configured: ${databases.join(", ") || "none"}`);

        if (this.configLoadedAt) {
            logger.info(`Configuration cached at: ${this.configLoadedAt.toISOString()}`);
        }
    }

    /**
     * Initialize Express with config
     */
    public static init(_express: Application): Application {
        return EnvConfig.getInstance().initExpress(_express);
    }

    public initExpress(_express: Application): Application {
        const config = this.getConfig();
        _express.locals["app"] = config;
        _express.locals["env"] = config.NODE_ENV;
        _express.locals["isProduction"] = config.NODE_ENV === "production";
        _express.locals["isStaging"] = config.NODE_ENV === "staging";
        _express.locals["isDevelopment"] = config.NODE_ENV === "development";
        _express.locals["isTest"] = config.NODE_ENV === "test";

        Logger.getInstance().info("Env Config :: Injected into Express");
        return _express;
    }

    // Static helper methods
    public static isProduction(): boolean {
        return EnvConfig.getConfig().NODE_ENV === "production";
    }

    public static isStaging(): boolean {
        return EnvConfig.getConfig().NODE_ENV === "staging";
    }

    public static isDevelopment(): boolean {
        return EnvConfig.getConfig().NODE_ENV === "development";
    }

    public static isTest(): boolean {
        return EnvConfig.getConfig().NODE_ENV === "test";
    }

    public static isServerMaintenance(): boolean {
        return EnvConfig.getConfig().SERVER_MAINTENANCE;
    }

    public static isSwaggerEnabled(): boolean {
        return EnvConfig.getConfig().ENABLE_SWAGGER;
    }

    public static getApiUrl(): string {
        const config = EnvConfig.getConfig();
        const baseUrl = config.API_BASE_URL || `http://localhost:${config.PORT}`;

        if (config.NODE_ENV === "staging") {
            return process.env["STAGING_API_URL"] || baseUrl;
        }

        if (config.NODE_ENV === "production") {
            return process.env["PRODUCTION_API_URL"] || baseUrl;
        }

        return baseUrl;
    }

    // Database helper methods
    public static isMongoConfigured(): boolean {
        return !!EnvConfig.getConfig().MONGO_URI;
    }

    public static isPostgresConfigured(): boolean {
        const config = EnvConfig.getConfig();
        return !!(config.PG_HOST && config.PG_DATABASE);
    }

    public static getDefaultDb(): string {
        return EnvConfig.getConfig().DEFAULT_DB || "mongodb";
    }

    // For testing only - never use in production
    public static resetInstance(): void {
        if (process.env.NODE_ENV === "production") {
            throw new Error("Cannot reset EnvConfig instance in production");
        }
        EnvConfig.instance = null;
    }
}

// Export the singleton instance
export default EnvConfig;

// Backward compatibility exports
export const getConfig = () => EnvConfig.getConfig();
export const initEnv = (express: Application) => EnvConfig.init(express);
export const isProduction = () => EnvConfig.isProduction();
export const isStaging = () => EnvConfig.isStaging();
export const isDevelopment = () => EnvConfig.isDevelopment();
export const isTest = () => EnvConfig.isTest();
export const isServerMaintenance = () => EnvConfig.isServerMaintenance();
export const isSwaggerEnabled = () => EnvConfig.isSwaggerEnabled();
export const getApiUrl = () => EnvConfig.getApiUrl();
export const isMongoConfigured = () => EnvConfig.isMongoConfigured();
export const isPostgresConfigured = () => EnvConfig.isPostgresConfigured();
export const getDefaultDb = () => EnvConfig.getDefaultDb();