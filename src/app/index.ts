import express, { Application, Request, Response } from "express";
import EnvConfig from "../config/env";
import SwaggerDocs from "../config/swagger";
import Logger from "../logger";
import Monitoring from "../monitoring";
import Http from "../middlewares/Http";
import Morgan from "../middlewares/Morgan";
import CORS from "../middlewares/CORS";
import ExceptionHandler from "../exceptions/Handler";

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

    private _mountRoutes(): void {
        const config = EnvConfig.getConfig();
        const apiPrefix = config.API_PREFIX ?? "api";

        // Health / probe routes
        this.express.get("/health", (_req: Request, res: Response) => {
            const cfg = EnvConfig.getConfig();
            res.status(200).json({
                status: "OK",
                environment: cfg.NODE_ENV,
                maintenance: cfg.SERVER_MAINTENANCE,
                timestamp: new Date().toISOString(),
                version: "1.0.0",
            });
        });

        this.express.get("/ready", (_req: Request, res: Response) => {
            res.status(200).json({ status: "ready" });
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
                timestamp: new Date().toISOString(),
            });
        });

        this.express.get(`/${apiPrefix}/environment`, (_req: Request, res: Response) => {
            const cfg = EnvConfig.getConfig();
            res.json({
                environment: cfg.NODE_ENV,
                maintenance: cfg.SERVER_MAINTENANCE,
                apiUrl: EnvConfig.getApiUrl(),
                timestamp: new Date().toISOString(),
            });
        });

        this.express.get(`/${apiPrefix}/users`, (_req: Request, res: Response) => {
            Monitoring.getInstance().incrementExternalApiCall("user_list");
            res.json({
                users: [
                    { id: 1, name: "John Doe" },
                    { id: 2, name: "Jane Doe" },
                ],
            });
        });

        this.express.get(`/${apiPrefix}/error`, (_req: Request, _res: Response) => {
            Monitoring.getInstance().recordError("TestError", `/${apiPrefix}/error`);
            throw new Error("Test error for monitoring");
        });

        Logger.getInstance().info("Routes :: Mounted");
    }

    /**
     * Error handlers must be registered AFTER all routes.
     * Order is: logErrors → clientErrorHandler → errorHandler → notFoundHandler (last).
     * notFoundHandler uses a wildcard catch-all so it must sit at the very end,
     * after the error middleware chain, otherwise Express swallows thrown errors into 404.
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
    }

    /**
     * Closes the HTTP server. The caller (e.g. src/index.ts) owns the
     * shutdown decision — no process.exit() here.
     */
    public _close(): Promise<void> {
        Logger.getInstance().info("Server :: Stopping...");
        return new Promise((resolve) => {
            this._server.close(() => {
                Logger.getInstance().info("Server :: Stopped");
                resolve();
            });
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
