import type { Application } from "express";
import type { IEnvConfig, Environment } from "../interfaces/core/config";
import Logger from "../logger";

class EnvConfig {
    private static config: IEnvConfig | null = null;

    public static getConfig(): IEnvConfig {
        if (!this.config) {
            this.config = this.loadConfig();
        }
        return this.config;
    }

    private static loadConfig(): IEnvConfig {
        const nodeEnv = (process.env["NODE_ENV"] as Environment) || "development";

        // Parse PORT - handle 0 as valid value
        let port = 4000; // default
        const portEnv = process.env["PORT"];
        if (portEnv !== undefined && portEnv !== "") {
            const parsedPort = parseInt(portEnv, 10);
            if (!isNaN(parsedPort)) {
                port = parsedPort;
            }
        }

        const config: IEnvConfig = {
            PORT: port,
            NODE_ENV: nodeEnv,
            SERVER_MAINTENANCE: process.env["SERVER_MAINTENANCE"] === "true",
            API_BASE_URL: process.env["API_BASE_URL"] || "http://localhost:5000",
            ENABLE_SWAGGER: process.env["ENABLE_SWAGGER"] === "true",
            CORS_ENABLED: process.env["CORS_ENABLED"] !== "false", // default true; opt-out via CORS_ENABLED=false
        };

        // Validate required keys
        const requiredKeys: (keyof IEnvConfig)[] = ["PORT", "NODE_ENV"];

        for (const key of requiredKeys) {
            if (config[key] === undefined || config[key] === null) {
                const error = `Missing required environment variable: ${key}`;
                Logger.getInstance().error(error);
                throw new Error(error);
            }
        }

        // Validate PORT is valid (allow 0 for OS-assigned port)
        if (typeof config.PORT !== "number" || isNaN(config.PORT) || config.PORT < 0 || config.PORT > 65535) {
            const error = `Invalid PORT number: ${config.PORT}. Must be between 0 and 65535.`;
            Logger.getInstance().error(error);
            throw new Error(error);
        }

        // Validate NODE_ENV (including staging)
        const validEnvs: Environment[] = ["development", "staging", "production", "test"];
        if (!validEnvs.includes(config.NODE_ENV)) {
            const error = `Invalid NODE_ENV: ${config.NODE_ENV}. Must be one of: ${validEnvs.join(", ")}`;
            Logger.getInstance().error(error);
            throw new Error(error);
        }

        // Log environment-specific warnings
        if (config.NODE_ENV === "staging") {
            Logger.getInstance().warn("Env Config :: Running in STAGING mode");
        }

        // Log if using dynamic port
        if (config.PORT === 0) {
            Logger.getInstance().info("Env Config :: Using dynamic port (OS will assign available port)");
        }


        if (config.NODE_ENV === "production" && config.ENABLE_SWAGGER) {
            Logger.getInstance().warn("Env Config :: Swagger is enabled in production - recommended to disable");
        }

        Logger.getInstance().info(`Env Config :: Loaded (${config.NODE_ENV} mode)`);
        return config;
    }

    /**
     * Injects your config to the app's locals
     */
    public static init(_express: Application): Application {
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

    // Helper methods - these are static methods on EnvConfig class
    public static isProduction(): boolean {
        return this.getConfig().NODE_ENV === "production";
    }

    public static isStaging(): boolean {
        return this.getConfig().NODE_ENV === "staging";
    }

    public static isDevelopment(): boolean {
        return this.getConfig().NODE_ENV === "development";
    }

    public static isTest(): boolean {
        return this.getConfig().NODE_ENV === "test";
    }

    public static isServerMaintenance(): boolean {
        return this.getConfig().SERVER_MAINTENANCE;
    }

    public static isSwaggerEnabled(): boolean {
        const config = this.getConfig();

        if (config.NODE_ENV === "production") {
            const envFlag = process.env["ENABLE_SWAGGER"];
            if (envFlag !== undefined) {
                return envFlag === "true";
            }
            return false;
        }

        if (config.NODE_ENV === "staging") {
            const envFlag = process.env["ENABLE_SWAGGER"];
            if (envFlag !== undefined) {
                return envFlag === "true";
            }
            return true;
        }

        const envFlag = process.env["ENABLE_SWAGGER"];
        if (envFlag !== undefined) {
            return envFlag === "true";
        }
        return true;
    }


    public static getApiUrl(): string {
        const config = this.getConfig();
        const baseUrl = process.env["API_BASE_URL"] || `http://localhost:${config.PORT}`;

        if (config.NODE_ENV === "staging") {
            return process.env["STAGING_API_URL"] || baseUrl;
        }

        if (config.NODE_ENV === "production") {
            return process.env["PRODUCTION_API_URL"] || baseUrl;
        }

        return baseUrl;
    }
}

export default EnvConfig;