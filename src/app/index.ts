// src/app.ts
import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import ConfigService from '../config/config.service';
import SwaggerDocs from '../config/swagger';
import Logger from '../logger';
import Monitoring from '../monitoring';
import Http from '../middlewares/Http';
import Morgan from '../middlewares/Morgan';
import CORS from '../middlewares/CORS';
import ExceptionHandler from '../exceptions/Handler';
import { DatabaseInitializer } from '../database/initializer';
import { shutdownTelemetry } from '../instrumentation';
import { ModuleRouter } from '../router/ModuleRouter';

export class ExpressApp {
    private _app: Application;
    private server: ReturnType<Application['listen']> | null = null;

    get express(): Application { return this._app; }

    constructor(private readonly db: DatabaseInitializer) {
        Logger.getInstance().info('App :: Initializing...');

        this._app = express();

        this._mountLogger();
        this._mountMiddlewares();
        this._mountMonitoring();
        this._mountConfigs();
        this._mountDatabaseMiddleware();
        this._mountRoutes();
        this._registerHandlers();

        Logger.getInstance().info('App :: Initialized');
    }

    private _mountLogger(): void {
        Logger._init();
        Logger.getInstance().info('Logger :: Mounted');
    }

    private _mountMiddlewares(): void {
        const config = ConfigService.getServerConfig();

        this._app = Http.mount(this._app);
        this._app = Morgan.mount(this._app);

        if (config.CORS_ENABLED) {
            this._app = CORS.mount(this._app);
        }

        this._app.use((_req: Request, res: Response, next: NextFunction) => {
            res.setHeader('X-Environment', config.NODE_ENV);
            res.setHeader('X-API-Version', '1.0.0');
            next();
        });

        this._app.use((req: Request, res: Response, next: NextFunction) => {
            if (ConfigService.isMaintenance() && req.path !== '/health') {
                res.status(503).json({ error: 'Server is under maintenance. Please try again later.' });
            } else {
                next();
            }
        });

        Logger.getInstance().info('App :: Middlewares registered');
    }

    private _mountMonitoring(): void {
        this._app.use(Monitoring.getInstance().middleware());
        Logger.getInstance().info('Monitoring :: Metrics middleware initialized');
    }

    private _mountConfigs(): void {
        this._app = ConfigService.initExpress(this._app);
        this._app = SwaggerDocs.init(this._app);
    }

    private _mountDatabaseMiddleware(): void {
        this._app.use((req: Request, _res: Response, next: NextFunction) => {
            if (this.db.isInitialized()) {
                req.repoFactory = this.db.getContainer().factory;
            }
            next();
        });
        Logger.getInstance().info('Database :: repository middleware mounted');
    }

    private _mountRoutes(): void {
        const config = ConfigService.getServerConfig();
        const prefix = config.API_PREFIX || 'api';

        // ── Infrastructure probes ──────────────────────────────────────────────
        this._app.get('/', (_req: Request, res: Response) => {
            const messages: Record<string, string> = {
                development: '🚀 Development Server - Social Media API',
                staging: '🧪 Staging Server - Social Media API',
                production: '🌍 Production Server - Social Media API',
                test: '🧪 Test Server - Social Media API',
            };
            res.json({
                message: messages[config.NODE_ENV] || messages.development,
                environment: config.NODE_ENV,
                version: '1.0.0',
                documentation: config.NODE_ENV !== 'production' ? '/api-docs' : 'https://docs.yourdomain.com',
                timestamp: new Date().toISOString(),
            });
        });

        this._app.get('/health', async (_req: Request, res: Response) => {
            const dbHealth = this.db.isInitialized()
                ? await this.db.healthCheck()
                : { error: 'not initialized' };
            res.status(200).json({
                status: 'OK',
                environment: config.NODE_ENV,
                maintenance: config.SERVER_MAINTENANCE,
                database: dbHealth,
                timestamp: new Date().toISOString(),
                version: '1.0.0',
            });
        });

        this._app.get('/ready', (_req: Request, res: Response) => {
            const ready = this.db.isInitialized();
            res.status(ready ? 200 : 503).json({
                status: ready ? 'ready' : 'not ready',
                database: ready ? 'connected' : 'disconnected',
            });
        });

        this._app.get('/live', (_req: Request, res: Response) => {
            res.status(200).json({ status: 'alive' });
        });

        this._app.get(`/${prefix}/environment`, (_req: Request, res: Response) => {
            res.json({
                environment: config.NODE_ENV,
                maintenance: config.SERVER_MAINTENANCE,
                apiUrl: ConfigService.getApiUrl(),
                timestamp: new Date().toISOString(),
            });
        });

        // ── Feature modules ────────────────────────────────────────────────────
        ModuleRouter.mount(this._app, prefix);

        Logger.getInstance().info('Routes :: Mounted');
    }

    private _registerHandlers(): void {
        this._app.use(ExceptionHandler.logErrors);
        this._app.use(ExceptionHandler.clientErrorHandler);
        this._app.use(ExceptionHandler.errorHandler);
        this._app = ExceptionHandler.notFoundHandler(this._app);
    }

    // async _init(): Promise<void> {
    //     Logger.getInstance().info('Server :: Starting...');
    //     // In development, run migrations automatically
    //     // In production, migrations should be run separately via CI/CD
    //     const env = process.env['NODE_ENV'] ?? 'development';
    //     const runMigrations = env === 'development' || process.env['AUTO_MIGRATE'] === 'true';

    //     await this.db.initialize({ skipMigrations: !runMigrations });

    //     const port = ConfigService.getPort();
    //     this.server = this._app.listen(port, () => {
    //         const actualPort = (this.server?.address() as any)?.port || port;
    //         Logger.getInstance().info(`🚀 Server running on http://localhost:${actualPort}`);
    //         Logger.getInstance().info(`📦 Environment: ConfigService.getNodeEnv().toUpperCase()`);
    //         Logger.getInstance().info(`🗄️  Database mode: active`);
    //         Logger.getInstance().info(`🔄 Migrations: ${runMigrations ? 'auto' : 'manual'}`);
    //     }).on('error', (err: Error) => {
    //         if (err.message.includes('EADDRINUSE')) {
    //             Logger.getInstance().error(`Port ${port} is in use. Waiting 1 second and retrying...`);
    //             setTimeout(() => {
    //                 this.server = this._app.listen(port);
    //             }, 1000);
    //         } else {
    //             Logger.getInstance().error(`Server error: ${err.message}`);
    //             process.exit(1);
    //         }
    //     });

    //     this._setupGracefulShutdown();
    //     Logger.getInstance().info('App :: Started');
    // }

    // Add this property to the class
    private isShuttingDown = false;
    private retryCount = 0;
    private readonly maxRetries = 3;

    async _init(): Promise<void> {
        Logger.getInstance().info('Server :: Starting...');

        // Add delay in development
        if (process.env.NODE_ENV === 'development') {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const env = process.env['NODE_ENV'] ?? 'development';
        const runMigrations = env === 'development' || process.env['AUTO_MIGRATE'] === 'true';

        await this.db.initialize({ skipMigrations: !runMigrations });

        const port = ConfigService.getPort();

        // const startServer = () => {
        //     this.server = this._app.listen(port, () => {
        //         this.retryCount = 0; // Reset retry count on success
        //         const actualPort = (this.server?.address() as any)?.port || port;
        //         Logger.getInstance().info(`🚀 Server running on http://localhost:${actualPort}`);
        //         Logger.getInstance().info(`📦 Environment: ${ConfigService.getNodeEnv().toUpperCase()}`);
        //         Logger.getInstance().info(`🗄️  Database mode: active`);
        //         Logger.getInstance().info(`🔄 Migrations: ${runMigrations ? 'auto' : 'manual'}`);
        //     }).on('error', (err: NodeJS.ErrnoException) => {
        //         if (err.code === 'EADDRINUSE') {
        //             this.retryCount++;
        //             if (this.retryCount <= this.maxRetries) {
        //                 Logger.getInstance().warn(`Port ${port} in use (attempt ${this.retryCount}/${this.maxRetries}), retrying in 2s...`);
        //                 setTimeout(startServer, 2000);
        //             } else {
        //                 Logger.getInstance().error(`Failed to bind to port ${port} after ${this.maxRetries} attempts`);
        //                 process.exit(1);
        //             }
        //         } else {
        //             Logger.getInstance().error(`Server error: ${err.message}`);
        //             process.exit(1);
        //         }
        //     });
        // };
        const startServer = () => {
            let isListening = false;

            this.server = this._app.listen(port, () => {
                if (!isListening) {
                    isListening = true;
                    this.retryCount = 0;
                    const actualPort = (this.server?.address() as any)?.port || port;
                    Logger.getInstance().info(`🚀 Server running on http://localhost:${actualPort}`);
                    Logger.getInstance().info(`📦 Environment: ${ConfigService.getNodeEnv().toUpperCase()}`);
                    Logger.getInstance().info(`🗄️  Database mode: active`);
                    Logger.getInstance().info(`🔄 Migrations: ${runMigrations ? 'auto' : 'manual'}`);
                }
            });

            this.server.on('error', (err: NodeJS.ErrnoException) => {
                if (isListening) return; // Ignore errors after successful bind

                if (err.code === 'EADDRINUSE') {
                    this.retryCount++;
                    if (this.retryCount <= this.maxRetries) {
                        Logger.getInstance().warn(`Port ${port} in use (attempt ${this.retryCount}/${this.maxRetries}), retrying in 2s...`);
                        setTimeout(startServer, 2000);
                    } else {
                        Logger.getInstance().error(`Failed to bind to port ${port} after ${this.maxRetries} attempts`);
                        process.exit(1);
                    }
                } else {
                    Logger.getInstance().error(`Server error: ${err.message}`);
                    process.exit(1);
                }
            });
        };
        startServer();
        this._setupGracefulShutdown();
        Logger.getInstance().info('App :: Started');
    }

    async _close(): Promise<void> {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        Logger.getInstance().info('Server :: Stopping...');

        // Force exit after 5 seconds if graceful shutdown hangs
        const forceExit = setTimeout(() => {
            Logger.getInstance().warn('Force exiting due to shutdown timeout');
            process.exit(0);
        }, 5000);

        try {
            await shutdownTelemetry();
            await this.db.shutdown();

            return new Promise((resolve) => {
                if (this.server && this.server.listening) {
                    this.server.close(() => {
                        Logger.getInstance().info('Server :: Stopped');
                        clearTimeout(forceExit);
                        resolve();
                    });
                } else {
                    clearTimeout(forceExit);
                    resolve();
                }
            });
        } catch (error) {
            Logger.getInstance().error(`Error during shutdown: ${error}`);
            clearTimeout(forceExit);
            process.exit(1);
        }
    }

    // async _close(): Promise<void> {
    //     Logger.getInstance().info('Server :: Stopping...');
    //     await shutdownTelemetry();
    //     await this.db.shutdown();
    //     return new Promise((resolve) => {
    //         if (this.server) {
    //             this.server.close(() => {
    //                 Logger.getInstance().info('Server :: Stopped');
    //                 resolve();
    //             });
    //         } else {
    //             resolve();
    //         }
    //     });
    // }

    private _setupGracefulShutdown(): void {
        const shutdown = async (): Promise<void> => {
            Logger.getInstance().info('Shutting down gracefully...');
            await this._close();
            process.exit(0);
        };
        process.once('SIGTERM', shutdown);
        process.once('SIGINT', shutdown);
    }
}

export default ExpressApp;