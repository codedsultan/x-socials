import express, { Application, Request, Response, NextFunction } from "express";
import EnvConfig from "../config/env";
import SwaggerDocs from "../config/swagger";
import Logger from "../logger";

class ExpressApp {
    private static app: Application;
    private static port: number;
    private static isInitialized: boolean = false;

    private constructor() { }

    public static _init(): void {
        if (!this.isInitialized) {
            this.app = express();

            // Load environment config first
            const config = EnvConfig.getConfig();
            this.port = config.PORT;

            this._initializeMiddleware();
            this._initializeConfigs();
            this._initializeRoutes();
            this._initializeErrorHandling();
            this._startServer();

            this.isInitialized = true;
        }
    }

    // Fixed: Now always returns Application (never null)
    public static getApp(): Application {
        if (!this.isInitialized) {
            this._init();
        }
        return this.app; // TypeScript knows this is always Application here
    }

    private static _initializeMiddleware(): void {
        if (!this.app) return;

        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Environment-specific headers
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            res.setHeader("X-Environment", EnvConfig.getConfig().NODE_ENV);
            res.setHeader("X-API-Version", "1.0.0");
            next();
        });

        // Request logging middleware with environment context
        this.app.use((req: Request, res: Response, next: NextFunction) => {
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
        this.app.get("/health", (req: Request, res: Response) => {
            const config = EnvConfig.getConfig();
            res.status(200).json({
                status: "OK",
                environment: config.NODE_ENV,
                maintenance: config.SERVER_MAINTENANCE,
                timestamp: new Date().toISOString(),
                version: "1.0.0"
            });
        });

        // Root route with environment-specific message
        this.app.get("/", (req: Request, res: Response) => {
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
        this.app.get("/api/environment", (req: Request, res: Response) => {
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
        this.app.get("/api/users", (req: Request, res: Response) => {
            res.json({
                users: [
                    { id: 1, name: "John Doe" },
                    { id: 2, name: "Jane Doe" }
                ]
            });
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

        this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            const config = EnvConfig.getConfig();
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
        const server = this.app.listen(this.port, () => {
            const envIcon = {
                development: "🚀",
                staging: "🧪",
                production: "🌍",
                test: "🧪"
            };

            Logger.getInstance().info(`${envIcon[config.NODE_ENV]} Server running on ${EnvConfig.getApiUrl()}`);
            Logger.getInstance().info(`📦 Environment: ${config.NODE_ENV.toUpperCase()}`);
            Logger.getInstance().info(`🔧 Maintenance Mode: ${config.SERVER_MAINTENANCE ? "ON" : "OFF"}`);

            if (config.NODE_ENV !== "production" || process.env.ENABLE_SWAGGER === "true") {
                Logger.getInstance().info(`📚 API Documentation: ${EnvConfig.getApiUrl()}/api-docs`);
            }
        });

        // Handle graceful shutdown
        process.on("SIGTERM", () => {
            Logger.getInstance().info("SIGTERM signal received: closing HTTP server");
            server.close(() => {
                Logger.getInstance().info("HTTP server closed");
            });
        });
    }
}

export default ExpressApp;