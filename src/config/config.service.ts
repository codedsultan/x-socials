// src/config/config.service.ts
import 'dotenv/config';
import type { Application } from "express";
import type {
    IEnvConfig,
    IDatabaseConfig,
    IAppConfig,
    Environment,
    IMongoDbConfig,
    IPostgresConfig,
    IMysqlConfig,
    ISqliteConfig
} from "../interfaces/core/config";
import type { DbType, ModelDbMapping } from '../interfaces/core/db-types';
import Logger from "../logger";

/**
 * Get the primary SQL database type from environment
 * Can be set via SQL_DB environment variable
 * Options: 'mysql', 'postgres', 'sqlite'
 * Default: 'mysql' (if not specified)
 */
function getPrimarySqlDb(): DbType {
    const sqlDb = process.env['SQL_DB']?.toLowerCase();

    if (sqlDb === 'postgres' || sqlDb === 'mysql' || sqlDb === 'sqlite') {
        return sqlDb;
    }

    // Default to MySQL
    console.log(`[INFO] SQL_DB not set, defaulting to 'mysql'`);
    return 'mysql';
}

/**
 * Model routing table - all SQL models use the same database
 */
function getModelMapping(): ModelDbMapping {
    const sqlDb = getPrimarySqlDb();

    return {
        User: sqlDb,
        Otp: sqlDb,
        Token: sqlDb,
        Post: 'mongodb',
        Comment: 'mongodb',
        Like: 'mongodb',
    };
}

/**
 * SINGLE SOURCE OF TRUTH - Unified Config Service
 */
export class ConfigService {
    private static instance: ConfigService;
    private config: IAppConfig;
    private modelMapping: ModelDbMapping;

    private constructor() {
        this.modelMapping = getModelMapping();
        this.config = this.loadConfig();
    }

    // ========== STATIC METHODS ==========

    static getInstance(): ConfigService {
        if (!ConfigService.instance) {
            ConfigService.instance = new ConfigService();
        }
        return ConfigService.instance;
    }

    static getDatabaseConfig(): IDatabaseConfig {
        return ConfigService.getInstance().getDatabaseConfig();
    }

    static getServerConfig(): IEnvConfig {
        return ConfigService.getInstance().getServerConfig();
    }

    static getFullConfig(): IAppConfig {
        return ConfigService.getInstance().getFullConfig();
    }

    static isProduction(): boolean {
        return ConfigService.getInstance().isProduction();
    }

    static isStaging(): boolean {
        return ConfigService.getInstance().isStaging();
    }

    static isDevelopment(): boolean {
        return ConfigService.getInstance().isDevelopment();
    }

    static isTest(): boolean {
        return ConfigService.getInstance().isTest();
    }

    static isServerMaintenance(): boolean {
        return ConfigService.getInstance().isMaintenance();
    }

    static isSwaggerEnabled(): boolean {
        return ConfigService.getInstance().isSwaggerEnabled();
    }

    static getDefaultDb(): string {
        return ConfigService.getInstance().getDefaultDb();
    }

    static getApiUrl(): string {
        return ConfigService.getInstance().getApiUrl();
    }

    static getPort(): number {
        return ConfigService.getInstance().getPort();
    }

    static getPrimarySqlDb(): DbType {
        return getPrimarySqlDb();
    }

    // For testing only
    static resetInstance(): void {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Cannot reset ConfigService in production');
        }
        ConfigService.instance = null as any;
    }

    static initExpress(app: Application): Application {
        return ConfigService.getInstance().initExpress(app);
    }

    // ========== INSTANCE METHODS ==========

    getServerConfig(): IEnvConfig {
        return this.config.server;
    }

    getDatabaseConfig(): IDatabaseConfig {
        return this.config.databases;
    }

    getFullConfig(): IAppConfig {
        return this.config;
    }

    getPort(): number {
        return this.config.server.PORT;
    }

    getNodeEnv(): Environment {
        return this.config.server.NODE_ENV;
    }

    getApiUrl(): string {
        return this.config.server.API_BASE_URL;
    }

    isProduction(): boolean {
        return this.config.server.NODE_ENV === 'production';
    }

    isDevelopment(): boolean {
        return this.config.server.NODE_ENV === 'development';
    }

    isStaging(): boolean {
        return this.config.server.NODE_ENV === 'staging';
    }

    isTest(): boolean {
        return this.config.server.NODE_ENV === 'test';
    }

    isMaintenance(): boolean {
        return this.config.server.SERVER_MAINTENANCE;
    }

    isSwaggerEnabled(): boolean {
        return this.config.server.ENABLE_SWAGGER;
    }

    getDefaultDb(): string {
        return this.config.databases.defaultDb;
    }

    getModelMapping(): ModelDbMapping {
        return this.modelMapping;
    }

    getPrimarySqlDb(): DbType {
        return getPrimarySqlDb();
    }

    // ========== PRIVATE LOADING LOGIC ==========

    private loadConfig(): IAppConfig {
        this.logInfo('Loading configuration...');
        this.logInfo(`Primary SQL Database: ${getPrimarySqlDb()}`);

        const config: IAppConfig = {
            server: this.loadServerConfig(),
            databases: this.loadDatabaseConfig()
        };

        this.logInfo('Configuration loaded successfully');
        return config;
    }

    private loadServerConfig(): IEnvConfig {
        const nodeEnv = this.getNodeEnvFromEnv();
        const port = this.getPortFromEnv();
        const primarySqlDb = getPrimarySqlDb();

        if (this.isProductionEnv()) {
            this.validateProductionConfig();
        }

        const config: IEnvConfig = {
            PORT: port,
            NODE_ENV: nodeEnv,
            SERVER_MAINTENANCE: process.env["SERVER_MAINTENANCE"] === "true",
            API_BASE_URL: this.getApiBaseUrlFromEnv(port),
            ENABLE_SWAGGER: this.getSwaggerEnabledFromEnv(nodeEnv),
            CORS_ENABLED: process.env["CORS_ENABLED"] !== "false",
            API_PREFIX: process.env["API_PREFIX"] || "/api",
            LOG_DAYS: this.getLogDaysFromEnv(),
            JWT_SECRET: this.getRequiredEnvVar("JWT_SECRET", this.isProductionEnv()),
            JWT_EXPIRES_IN: process.env["JWT_EXPIRES_IN"] || "7d",
            SENDGRID_API_KEY: process.env["SENDGRID_API_KEY"],
            SMTP_FROM: process.env["SMTP_FROM"],
            CLOUDINARY_CLOUD_NAME: process.env["CLOUDINARY_CLOUD_NAME"],
            CLOUDINARY_API_KEY: process.env["CLOUDINARY_API_KEY"],
            CLOUDINARY_API_SECRET: process.env["CLOUDINARY_API_SECRET"],

            // SQL Database configuration
            SQL_DB: primarySqlDb,

            // PostgreSQL config (used when SQL_DB=postgres)
            PG_HOST: process.env["PG_HOST"],
            PG_PORT: process.env["PG_PORT"],
            PG_DATABASE: process.env["PG_DATABASE"],
            PG_USER: process.env["PG_USER"],
            PG_PASSWORD: process.env["PG_PASSWORD"],
            PG_SSL: process.env["PG_SSL"],
            PG_CLIENT: process.env["PG_CLIENT"] || "pg",
            PG_POOL_MIN: process.env["PG_POOL_MIN"],
            PG_POOL_MAX: process.env["PG_POOL_MAX"],

            // MySQL config (used when SQL_DB=mysql)
            MYSQL_HOST: process.env["MYSQL_HOST"],
            MYSQL_PORT: process.env["MYSQL_PORT"],
            MYSQL_DATABASE: process.env["MYSQL_DATABASE"],
            MYSQL_USER: process.env["MYSQL_USER"],
            MYSQL_PASSWORD: process.env["MYSQL_PASSWORD"],
            MYSQL_CLIENT: process.env["MYSQL_CLIENT"] || "mysql2",

            // SQLite config (used when SQL_DB=sqlite)
            SQLITE_FILENAME: process.env["SQLITE_FILENAME"],
            SQLITE_CLIENT: process.env["SQLITE_CLIENT"] || "better-sqlite3",

            // MongoDB config
            MONGO_URI: process.env["MONGO_URI"],
            MONGO_DB_NAME: process.env["MONGO_DB_NAME"],
            DB_NAME: process.env["DB_NAME"],
            MONGO_SOCKET_TIMEOUT_MS: process.env["MONGO_SOCKET_TIMEOUT_MS"],
            MONGO_SERVER_SELECTION_TIMEOUT_MS: process.env["MONGO_SERVER_SELECTION_TIMEOUT_MS"],

            // Default database
            DEFAULT_DB: process.env["DEFAULT_DB"] || "mongodb",
        };

        if (!this.isProductionEnv()) {
            this.logServerConfig(config);
        }

        return config;
    }

    private loadDatabaseConfig(): IDatabaseConfig {
        const defaultDb = (process.env["DEFAULT_DB"] || "mongodb") as DbType;
        const dbMode = (process.env['DB_MODE'] ?? 'split') as 'split' | 'single';
        const primarySqlDb = getPrimarySqlDb();

        if (this.isProductionEnv()) {
            this.validateDatabaseConfig();
        }

        const config: IDatabaseConfig = {
            defaultDb,
            dbMode,
        };

        // Add MongoDB config if present
        if (process.env["MONGO_URI"]) {
            config.mongodb = this.buildMongoConfig();
        }

        // Add only the selected SQL database
        switch (primarySqlDb) {
            case 'postgres':
                if (process.env["PG_HOST"] && process.env["PG_DATABASE"]) {
                    config.postgres = this.buildPostgresConfig();
                    this.logInfo(`✅ Configured PostgreSQL at ${process.env["PG_HOST"]}:${process.env["PG_PORT"]}`);
                } else {
                    this.logWarn('⚠️ PostgreSQL selected but PG_HOST or PG_DATABASE not set');
                }
                break;

            case 'mysql':
                if (process.env["MYSQL_HOST"] && process.env["MYSQL_DATABASE"]) {
                    config.mysql = this.buildMysqlConfig();
                    this.logInfo(`✅ Configured MySQL at ${process.env["MYSQL_HOST"]}:${process.env["MYSQL_PORT"]}`);
                } else {
                    this.logWarn('⚠️ MySQL selected but MYSQL_HOST or MYSQL_DATABASE not set');
                }
                break;

            case 'sqlite':
                if (process.env["SQLITE_FILENAME"]) {
                    config.sqlite = this.buildSqliteConfig();
                    this.logInfo(`✅ Configured SQLite at ${process.env["SQLITE_FILENAME"]}`);
                } else {
                    this.logWarn('⚠️ SQLite selected but SQLITE_FILENAME not set');
                }
                break;
        }

        return config;
    }

    // ========== HELPER METHODS ==========

    private isProductionEnv(): boolean {
        return process.env.NODE_ENV === 'production';
    }

    private getNodeEnvFromEnv(): Environment {
        const env = process.env["NODE_ENV"] as Environment;

        if (this.isProductionEnv() && !env) {
            throw new Error("NODE_ENV must be set in production environment");
        }

        const nodeEnv = env || "development";
        const validEnvs: Environment[] = ["development", "staging", "production", "test"];

        if (!validEnvs.includes(nodeEnv)) {
            throw new Error(`Invalid NODE_ENV: ${nodeEnv}`);
        }

        return nodeEnv;
    }

    private getPortFromEnv(): number {
        const portEnv = process.env["PORT"];

        if (this.isProductionEnv() && !portEnv) {
            throw new Error("PORT must be set in production environment");
        }

        if (!portEnv || portEnv === "") {
            return 4000;
        }

        const port = parseInt(portEnv, 10);

        if (isNaN(port)) {
            if (this.isProductionEnv()) {
                throw new Error(`Invalid PORT number: ${portEnv}`);
            }
            return 4000;
        }

        if (port < 0 || port > 65535) {
            throw new Error(`Invalid PORT number: ${port}`);
        }

        return port;
    }

    private getApiBaseUrlFromEnv(port: number): string {
        const baseUrl = process.env["API_BASE_URL"];

        if (this.isProductionEnv() && !baseUrl) {
            throw new Error("API_BASE_URL must be set in production");
        }

        if (!baseUrl && !this.isProductionEnv()) {
            return `http://localhost:${port}`;
        }

        return baseUrl || `http://localhost:${port}`;
    }

    private getSwaggerEnabledFromEnv(nodeEnv: Environment): boolean {
        const explicitValue = process.env["ENABLE_SWAGGER"];

        if (explicitValue !== undefined) {
            return explicitValue === "true";
        }

        return nodeEnv !== "production";
    }

    private getLogDaysFromEnv(): number | undefined {
        const logDays = process.env["LOG_DAYS"];
        if (!logDays) return undefined;

        const days = parseInt(logDays, 10);
        if (isNaN(days)) return undefined;

        if (this.isProductionEnv() && (days < 1 || days > 90)) {
            throw new Error(`LOG_DAYS must be between 1 and 90 in production, got: ${days}`);
        }

        return days;
    }

    private getRequiredEnvVar(key: string, required: boolean): string | undefined {
        const value = process.env[key];
        if (required && !value) {
            throw new Error(`Required environment variable ${key} is missing in production`);
        }
        return value;
    }

    private validateProductionConfig(): void {
        const requiredVars = ["JWT_SECRET", "API_BASE_URL"];
        const missingVars = requiredVars.filter(key => !process.env[key]);

        if (missingVars.length > 0) {
            throw new Error(`Missing required production variables: ${missingVars.join(", ")}`);
        }

        const jwtSecret = process.env["JWT_SECRET"];
        if (jwtSecret && jwtSecret.length < 32) {
            throw new Error("JWT_SECRET must be at least 32 characters in production");
        }
    }

    private validateDatabaseConfig(): void {
        const primarySqlDb = getPrimarySqlDb();
        let hasDatabase = false;

        // Check MongoDB
        if (process.env["MONGO_URI"]) {
            hasDatabase = true;
        }

        // Check selected SQL database
        if (primarySqlDb === 'postgres' && process.env["PG_HOST"] && process.env["PG_DATABASE"]) {
            hasDatabase = true;
        } else if (primarySqlDb === 'mysql' && process.env["MYSQL_HOST"] && process.env["MYSQL_DATABASE"]) {
            hasDatabase = true;
        } else if (primarySqlDb === 'sqlite' && process.env["SQLITE_FILENAME"]) {
            hasDatabase = true;
        }

        if (!hasDatabase) {
            throw new Error(`At least one database must be configured in production. Selected SQL_DB: ${primarySqlDb}`);
        }
    }

    private buildMongoConfig(): IMongoDbConfig {
        return {
            uri: process.env["MONGO_URI"]!,
            dbName: process.env["MONGO_DB_NAME"] || process.env["DB_NAME"] || "test",
            socketTimeoutMS: parseInt(process.env["MONGO_SOCKET_TIMEOUT_MS"] || "30000", 10),
            serverSelectionTimeoutMS: parseInt(process.env["MONGO_SERVER_SELECTION_TIMEOUT_MS"] || "30000", 10),
        };
    }

    private buildPostgresConfig(): IPostgresConfig {
        return {
            host: process.env["PG_HOST"]!,
            port: parseInt(process.env["PG_PORT"] || "5432", 10),
            database: process.env["PG_DATABASE"]!,
            user: process.env["PG_USER"],
            password: process.env["PG_PASSWORD"],
            ssl: process.env["PG_SSL"] === "true",
            client: process.env["PG_CLIENT"] || "pg",
            poolMin: parseInt(process.env["PG_POOL_MIN"] || "2", 10),
            poolMax: parseInt(process.env["PG_POOL_MAX"] || "10", 10),
        };
    }

    private buildMysqlConfig(): IMysqlConfig {
        return {
            host: process.env["MYSQL_HOST"]!,
            port: parseInt(process.env["MYSQL_PORT"] || "3306", 10),
            database: process.env["MYSQL_DATABASE"]!,
            user: process.env["MYSQL_USER"],
            password: process.env["MYSQL_PASSWORD"],
            client: process.env["MYSQL_CLIENT"] || "mysql2",
            poolMin: parseInt(process.env["PG_POOL_MIN"] || "2", 10),
            poolMax: parseInt(process.env["PG_POOL_MAX"] || "10", 10),
        };
    }

    private buildSqliteConfig(): ISqliteConfig {
        return {
            filename: process.env["SQLITE_FILENAME"]!,
            client: process.env["SQLITE_CLIENT"] || "better-sqlite3",
            poolMin: parseInt(process.env["PG_POOL_MIN"] || "1", 10),
            poolMax: parseInt(process.env["PG_POOL_MAX"] || "1", 10),
        };
    }

    // ========== LOGGING METHODS ==========

    private logInfo(message: string): void {
        if (process.env.NODE_ENV === 'production') {
            try {
                const logger = Logger.getInstance();
                logger.info(message);
            } catch {
                console.log(`[INFO] ${message}`);
            }
        } else {
            console.log(`[INFO] ${message}`);
        }
    }

    private logWarn(message: string): void {
        if (process.env.NODE_ENV === 'production') {
            try {
                const logger = Logger.getInstance();
                logger.warn(message);
            } catch {
                console.warn(`[WARN] ${message}`);
            }
        } else {
            console.warn(`[WARN] ${message}`);
        }
    }

    private logServerConfig(config: IEnvConfig): void {
        const safeConfig = { ...config };
        if (safeConfig.JWT_SECRET) safeConfig.JWT_SECRET = "***";
        if (safeConfig.SENDGRID_API_KEY) safeConfig.SENDGRID_API_KEY = "***";
        if (safeConfig.CLOUDINARY_API_SECRET) safeConfig.CLOUDINARY_API_SECRET = "***";

        this.logInfo(`Server config: port=${config.PORT}, env=${config.NODE_ENV}`);
        this.logInfo(`Features: cors=${config.CORS_ENABLED}, swagger=${config.ENABLE_SWAGGER}`);

        const databases = [];
        if (config.MONGO_URI) databases.push("MongoDB");
        if (config.PG_HOST && config.PG_DATABASE) databases.push("PostgreSQL");
        if (config.MYSQL_HOST && config.MYSQL_DATABASE) databases.push("MySQL");
        if (config.SQLITE_FILENAME) databases.push("SQLite");

        if (databases.length > 0) {
            this.logInfo(`Databases: ${databases.join(", ")}`);
        }
    }

    // ========== EXPRESS INTEGRATION ==========

    initExpress(app: Application): Application {
        const config = this.getServerConfig();
        app.locals = {
            ...app.locals,
            config,
            env: config.NODE_ENV,
            isProduction: config.NODE_ENV === "production",
            isStaging: config.NODE_ENV === "staging",
            isDevelopment: config.NODE_ENV === "development",
            isTest: config.NODE_ENV === "test",
        };

        this.logInfo("Config injected into Express");
        return app;
    }
}

// Export singleton instance
export default ConfigService.getInstance();