import express, { Application, Request, Response, NextFunction } from "express";
import EnvConfig from "../config/env";
import SwaggerDocs from "../config/swagger";
import Logger from "../logger";
import Monitoring from "../monitoring";

class ExpressApp {
    private static app: Application;
    private static port: number;
    private static isInitialized: boolean = false;
    private static server: any;

    private constructor() { }

    public static _init(): void {
        if (!this.isInitialized) {
            this.app = express();

            // Load environment config first
            const config = EnvConfig.getConfig();
            this.port = config.PORT;

            this._initializeMiddleware();
            this._initializeMonitoring();
            this._initializeConfigs();
            this._initializeRoutes();
            this._initializeErrorHandling();
            this._startServer();

            this.isInitialized = true;
        }
    }

    public static getApp(): Application {
        if (!this.isInitialized) {
            this._init();
        }
        return this.app;
    }

    private static _initializeMiddleware(): void {
        if (!this.app) return;

        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Environment-specific headers
        this.app.use((_req: Request, res: Response, next: NextFunction) => {
            res.setHeader("X-Environment", EnvConfig.getConfig().NODE_ENV);
            res.setHeader("X-API-Version", "1.0.0");
            next();
        });

        // Request logging middleware with environment context
        this.app.use((req: Request, _res: Response, next: NextFunction) => {
            const env = EnvConfig.getConfig().NODE_ENV;
            Logger.getInstance().info(`[${env.toUpperCase()}] ${req.method} ${req.path}`);
            next();
        });

        // Maintenance mode check
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            if (EnvConfig.isServerMaintenance() && req.path !== "/health") {
                res.status(503).json({
                    error: "Server is under maintenance. Please try again later.",
                    environment: EnvConfig.getConfig().NODE_ENV
                });
            } else {
                next();
            }
        });
    }

    private static _initializeMonitoring(): void {
        if (!this.app) return;

        // Add monitoring middleware for metrics collection
        this.app.use(Monitoring.getInstance().middleware());

        // Add Prometheus metrics endpoint (if using separate port, this is optional)
        // Monitoring is already exposed on port 9464 via instrumentation.ts
        Logger.getInstance().info("Monitoring :: Metrics middleware initialized");
    }

    private static _initializeConfigs(): void {
        if (!this.app) return;

        // Initialize Environment Config
        EnvConfig.init(this.app);

        // Initialize Swagger Docs (only in development/staging)
        SwaggerDocs.init(this.app);
    }

    private static _initializeRoutes(): void {
        if (!this.app) return;

        // Health check route with environment info
        this.app.get("/health", (_req: Request, res: Response) => {
            const config = EnvConfig.getConfig();
            res.status(200).json({
                status: "OK",
                environment: config.NODE_ENV,
                maintenance: config.SERVER_MAINTENANCE,
                timestamp: new Date().toISOString(),
                version: "1.0.0"
            });
        });

        // Readiness probe (for Kubernetes)
        this.app.get("/ready", (_req: Request, res: Response) => {
            res.status(200).json({ status: "ready" });
        });

        // Liveness probe (for Kubernetes)
        this.app.get("/live", (_req: Request, res: Response) => {
            res.status(200).json({ status: "alive" });
        });

        // Root route with environment-specific message
        this.app.get("/", (_req: Request, res: Response) => {
            const config = EnvConfig.getConfig();
            const messages = {
                development: "🚀 Development Server - Social Media API",
                staging: "🧪 Staging Server - Social Media API (Testing)",
                production: "🌍 Production Server - Social Media API",
                test: "🧪 Test Server - Social Media API"
            };

            res.json({
                message: messages[config.NODE_ENV] || messages.development,
                environment: config.NODE_ENV,
                version: "1.0.0",
                documentation: config.NODE_ENV === "production" && !process.env.ENABLE_SWAGGER
                    ? "Documentation available at https://docs.yourdomain.com"
                    : "/api-docs",
                monitoring: {
                    metrics: "http://localhost:9464/metrics",
                    prometheus_port: 9464
                },
                timestamp: new Date().toISOString()
            });
        });

        /**
         * @openapi
         * /api/environment:
         *   get:
         *     tags:
         *       - System
         *     summary: Get environment information
         *     description: Returns current environment configuration
         *     responses:
         *       200:
         *         description: Environment info
         */
        this.app.get("/api/environment", (_req: Request, res: Response) => {
            const config = EnvConfig.getConfig();
            res.json({
                environment: config.NODE_ENV,
                maintenance: config.SERVER_MAINTENANCE,
                apiUrl: EnvConfig.getApiUrl(),
                timestamp: new Date().toISOString()
            });
        });

        /**
         * @openapi
         * /api/users:
         *   get:
         *     tags:
         *       - Users
         *     summary: Get all users
         *     description: Returns a list of users
         *     responses:
         *       200:
         *         description: Successful response
         */
        this.app.get("/api/users", (_req: Request, res: Response) => {
            // Record business metric
            Monitoring.getInstance().incrementExternalApiCall("user_list");

            res.json({
                users: [
                    { id: 1, name: "John Doe" },
                    { id: 2, name: "Jane Doe" }
                ]
            });
        });

        // Example error route for testing monitoring
        this.app.get("/api/error", (_req: Request, res: Response) => {
            Monitoring.getInstance().recordError("TestError", "/api/error");
            throw new Error("Test error for monitoring");
        });

        // 404 handler
        this.app.use((req: Request, res: Response) => {
            const config = EnvConfig.getConfig();
            Logger.getInstance().warn(`[${config.NODE_ENV}] Route not found: ${req.method} ${req.path}`);
            res.status(404).json({
                error: "Route not found",
                path: req.path,
                environment: config.NODE_ENV
            });
        });
    }

    private static _initializeErrorHandling(): void {
        if (!this.app) return;

        this.app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
            const config = EnvConfig.getConfig();

            // Record error in monitoring
            Monitoring.getInstance().recordError(err.name, req.route?.path || req.path);
            Logger.getInstance().error(`[${config.NODE_ENV}] Error: ${err.message}`);
            Logger.getInstance().error(err.stack || "");

            // Different error detail levels per environment
            const errorResponse: any = {
                error: "Internal server error",
                environment: config.NODE_ENV
            };

            if (config.NODE_ENV === "development" || config.NODE_ENV === "staging") {
                errorResponse.message = err.message;
                errorResponse.stack = err.stack;
            }

            res.status(500).json(errorResponse);
        });
    }

    private static _startServer(): void {
        if (!this.app) return;

        const config = EnvConfig.getConfig();
        this.server = this.app.listen(this.port, () => {
            const envIcon = {
                development: "🚀",
                staging: "🧪",
                production: "🌍",
                test: "🧪"
            };

            Logger.getInstance().info(`${envIcon[config.NODE_ENV]} Server running on ${EnvConfig.getApiUrl()}`);
            Logger.getInstance().info(`📦 Environment: ${config.NODE_ENV.toUpperCase()}`);
            Logger.getInstance().info(`🔧 Maintenance Mode: ${config.SERVER_MAINTENANCE ? "ON" : "OFF"}`);
            Logger.getInstance().info(`📊 Prometheus metrics: http://localhost:9464/metrics`);

            if (config.NODE_ENV !== "production" || process.env.ENABLE_SWAGGER === "true") {
                Logger.getInstance().info(`📚 API Documentation: ${EnvConfig.getApiUrl()}/api-docs`);
            }
        });

        // Handle graceful shutdown
        this._setupGracefulShutdown();
    }

    private static _setupGracefulShutdown(): void {
        if (!this.server) return;

        const shutdown = async () => {
            Logger.getInstance().info("Shutting down gracefully...");

            // Close server
            await new Promise((resolve) => {
                this.server.close(resolve);
            });

            Logger.getInstance().info("HTTP server closed");

            // Give some time for loggers to flush
            setTimeout(() => {
                Logger.getInstance().info("Exiting process");
                process.exit(0);
            }, 1000);
        };

        process.on("SIGTERM", shutdown);
        process.on("SIGINT", shutdown);
    }
}

export default ExpressApp;