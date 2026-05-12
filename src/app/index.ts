// src/app.ts
import express, { Application, Request, Response } from "express";
import EnvConfig from "../config/env";
import SwaggerDocs from "../config/swagger";
import Logger from "../logger";
import Monitoring from "../monitoring";
import Http from "../middlewares/Http";
import Morgan from "../middlewares/Morgan";
import CORS from "../middlewares/CORS";
import ExceptionHandler from "../exceptions/Handler";
import { DatabaseInitializer } from "../database/initializer";
import { getRepositoryFactory } from "../config/database.config";

/**
 * @name ExpressApp
 * @description Instance-based Express application wrapper.
 * Construct once; call _init() to start listening.
 */
class ExpressApp {
    public express: Application;
    private _server: any;

    constructor() {
        Logger.getInstance().info("App :: Initializing...");

        this.express = express();

        this._mountLogger();
        this._mountMiddlewares();
        this._mountMonitoring();
        this._mountConfigs();
        this._mountDatabase(); // NEW: Mount database
        this._mountRoutes();
        this._registerHandlers();

        Logger.getInstance().info("App :: Initialized");
    }

    // ─── private setup steps ────────────────────────────────────────────────

    private _mountLogger(): void {
        Logger._init();
        Logger.getInstance().info("Logger :: Mounted");
    }

    private _mountMiddlewares(): void {
        Logger.getInstance().info("App :: Registering middlewares...");

        // Security, compression, body parsing
        this.express = Http.mount(this.express);

        // HTTP request logging via Morgan → Winston
        this.express = Morgan.mount(this.express);

        // CORS — opt-out via CORS_ENABLED=false
        if (EnvConfig.getConfig().CORS_ENABLED) {
            this.express = CORS.mount(this.express);
        }

        // Environment-specific headers
        this.express.use((_req: Request, res: Response, next: any) => {
            res.setHeader("X-Environment", EnvConfig.getConfig().NODE_ENV);
            res.setHeader("X-API-Version", "1.0.0");
            next();
        });

        // Maintenance mode check
        this.express.use((req: Request, res: Response, next: any) => {
            if (EnvConfig.isServerMaintenance() && req.path !== "/health") {
                res.status(503).json({
                    error: "Server is under maintenance. Please try again later.",
                    environment: EnvConfig.getConfig().NODE_ENV,
                });
            } else {
                next();
            }
        });

        Logger.getInstance().info("App :: Middlewares registered");
    }

    private _mountMonitoring(): void {
        this.express.use(Monitoring.getInstance().middleware());
        Logger.getInstance().info("Monitoring :: Metrics middleware initialized");
    }

    private _mountConfigs(): void {
        this.express = EnvConfig.init(this.express);
        this.express = SwaggerDocs.init(this.express);
    }

    private _mountDatabase(): void {
        // Make repositories available to routes via middleware
        this.express.use((req: Request, res: Response, next: any) => {
            try {
                if (DatabaseInitializer.isInitialized()) {
                    const repoFactory = getRepositoryFactory();
                    req.repositories = {
                        user: repoFactory.getRepository('User'),
                        post: repoFactory.getRepository('Post'),
                        comment: repoFactory.getRepository('Comment'),
                        like: repoFactory.getRepository('Like'),
                        otp: repoFactory.getRepository('Otp'),
                        token: repoFactory.getRepository('Token'),
                    };
                }
                next();
            } catch (error) {
                // If database not initialized yet, just proceed without repos
                next();
            }
        });

        Logger.getInstance().info("Database :: Repository middleware mounted");
    }

    private _mountRoutes(): void {
        const config = EnvConfig.getConfig();
        const apiPrefix = config.API_PREFIX ?? "api";

        // Health / probe routes
        this.express.get("/health", async (_req: Request, res: Response) => {
            const cfg = EnvConfig.getConfig();
            const dbHealth = DatabaseInitializer.isInitialized()
                ? await DatabaseInitializer.healthCheck()
                : { error: "Not initialized" };

            res.status(200).json({
                status: "OK",
                environment: cfg.NODE_ENV,
                maintenance: cfg.SERVER_MAINTENANCE,
                database: dbHealth,
                databaseMode: DatabaseInitializer.isInitialized()
                    ? getRepositoryFactory() ? "connected" : "initialized"
                    : "pending",
                timestamp: new Date().toISOString(),
                version: "1.0.0",
            });
        });

        this.express.get("/ready", (_req: Request, res: Response) => {
            const isDbReady = DatabaseInitializer.isInitialized();
            res.status(isDbReady ? 200 : 503).json({
                status: isDbReady ? "ready" : "not ready",
                database: isDbReady ? "connected" : "disconnected"
            });
        });

        this.express.get("/live", (_req: Request, res: Response) => {
            res.status(200).json({ status: "alive" });
        });

        // Root
        this.express.get("/", (_req: Request, res: Response) => {
            const cfg = EnvConfig.getConfig();
            const messages: Record<string, string> = {
                development: "🚀 Development Server - Social Media API",
                staging: "🧪 Staging Server - Social Media API (Testing)",
                production: "🌍 Production Server - Social Media API",
                test: "🧪 Test Server - Social Media API",
            };

            res.json({
                message: messages[cfg.NODE_ENV] ?? messages["development"],
                environment: cfg.NODE_ENV,
                version: "1.0.0",
                documentation:
                    cfg.NODE_ENV === "production" && !process.env["ENABLE_SWAGGER"]
                        ? "Documentation available at https://docs.yourdomain.com"
                        : "/api-docs",
                monitoring: {
                    metrics: "http://localhost:9464/metrics",
                    prometheus_port: 9464,
                },
                database: {
                    configured: this._getConfiguredDatabases(),
                    mode: DatabaseInitializer.isInitialized() ? "active" : "pending",
                },
                timestamp: new Date().toISOString(),
            });
        });

        this.express.get(`/${apiPrefix}/environment`, (_req: Request, res: Response) => {
            const cfg = EnvConfig.getConfig();
            res.json({
                environment: cfg.NODE_ENV,
                maintenance: cfg.SERVER_MAINTENANCE,
                apiUrl: EnvConfig.getApiUrl(),
                database: {
                    defaultDb: EnvConfig.getDefaultDb(),
                    configured: this._getConfiguredDatabases(),
                },
                timestamp: new Date().toISOString(),
            });
        });

        // Example routes that use repositories
        this.express.get(`/${apiPrefix}/users`, async (req: Request, res: Response) => {
            try {
                Monitoring.getInstance().incrementExternalApiCall("user_list");

                // Get repositories from request (injected by middleware)
                const repositories = (req as any).repositories;
                if (!repositories) {
                    return res.status(503).json({ error: "Database not ready" });
                }

                const users = await repositories.user.findMany({});
                res.json({ users });
            } catch (error) {
                Logger.getInstance().error(`Error fetching users: ${error}`);
                res.status(500).json({ error: "Internal server error" });
            }
        });

        this.express.get(`/${apiPrefix}/error`, (_req: Request, _res: Response) => {
            Monitoring.getInstance().recordError("TestError", `/${apiPrefix}/error`);
            throw new Error("Test error for monitoring");
        });

        Logger.getInstance().info("Routes :: Mounted");
    }

    private _getConfiguredDatabases(): string[] {
        const config = EnvConfig.getConfig();
        const configured: string[] = [];
        if (config.MONGO_URI) configured.push('mongodb');
        if (config.PG_HOST && config.PG_DATABASE) configured.push('postgres');
        if (config.MYSQL_HOST && config.MYSQL_DATABASE) configured.push('mysql');
        if (config.SQLITE_FILENAME) configured.push('sqlite');
        return configured;
    }

    /**
     * Error handlers must be registered AFTER all routes.
     */
    private _registerHandlers(): void {
        Logger.getInstance().info("App :: Registering handlers...");

        this.express.use(ExceptionHandler.logErrors);
        this.express.use(ExceptionHandler.clientErrorHandler);
        this.express.use(ExceptionHandler.errorHandler);
        this.express = ExceptionHandler.notFoundHandler(this.express);

        Logger.getInstance().info("App :: Handlers registered");
    }

    // ─── public API ─────────────────────────────────────────────────────────

    /**
     * Starts the HTTP server. Separated from the constructor so tests can
     * import and inspect the app without binding a port.
     */
    public async _init(): Promise<void> {
        Logger.getInstance().info("Server :: Starting...");

        try {
            // Initialize database BEFORE starting server
            await DatabaseInitializer.initialize();

            const port = EnvConfig.getConfig().PORT;

            this._server = this.express
                .listen(port, () => {
                    const config = EnvConfig.getConfig();
                    const envIcon: Record<string, string> = {
                        development: "🚀",
                        staging: "🧪",
                        production: "🌍",
                        test: "🧪",
                    };

                    Logger.getInstance().info(
                        `${envIcon[config.NODE_ENV]} Server running on ${EnvConfig.getApiUrl()}`
                    );
                    Logger.getInstance().info(
                        `📦 Environment: ${config.NODE_ENV.toUpperCase()}`
                    );
                    Logger.getInstance().info(
                        `🔧 Maintenance Mode: ${config.SERVER_MAINTENANCE ? "ON" : "OFF"}`
                    );
                    Logger.getInstance().info(
                        `📊 Prometheus metrics: http://localhost:9464/metrics`
                    );
                    Logger.getInstance().info(
                        `🗄️  Database Mode: ${DatabaseInitializer.isInitialized() ? "Connected" : "Failed"}`
                    );

                    if (
                        config.NODE_ENV !== "production" ||
                        process.env["ENABLE_SWAGGER"] === "true"
                    ) {
                        Logger.getInstance().info(
                            `📚 API Documentation: ${EnvConfig.getApiUrl()}/api-docs`
                        );
                    }
                })
                .on("error", (err: Error) => {
                    Logger.getInstance().error(`Server error: ${err.message}`);
                });

            this._setupGracefulShutdown();
            Logger.getInstance().info("App :: Started");
        } catch (error) {
            Logger.getInstance().error(`Failed to start server: ${error}`);
            throw error;
        }
    }

    /**
     * Closes the HTTP server and database connections.
     */
    public async _close(): Promise<void> {
        Logger.getInstance().info("Server :: Stopping...");

        // Close database connections first
        // await DatabaseInitializer.shutdown();
        if (DatabaseInitializer.isInitialized()) {
            await DatabaseInitializer.shutdown();
        }

        // Then close server
        return new Promise((resolve) => {
            if (this._server) {
                this._server.close(() => {
                    Logger.getInstance().info("Server :: Stopped");
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    private _setupGracefulShutdown(): void {
        const shutdown = async () => {
            Logger.getInstance().info("Shutting down gracefully...");
            await this._close();
            process.exit(0);
        };

        process.on("SIGTERM", shutdown);
        process.on("SIGINT", shutdown);
    }
}

export default new ExpressApp();