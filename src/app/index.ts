import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import EnvConfig    from '../config/env';
import SwaggerDocs  from '../config/swagger';
import Logger       from '../logger';
import Monitoring   from '../monitoring';
import Http         from '../middlewares/Http';
import Morgan       from '../middlewares/Morgan';
import CORS         from '../middlewares/CORS';
import ExceptionHandler from '../exceptions/Handler';
import { DatabaseInitializer } from '../database/initializer';
import { shutdownTelemetry }  from '../instrumentation';

/**
 * ExpressApp wraps the Express application.
 *
 * Key changes from original:
 *  - Exported as a CLASS, not `new ExpressApp()` — tests instantiate their own.
 *  - Receives a DatabaseInitializer via constructor (dependency injection).
 *  - req.repoFactory is the injection point — no flat `req.repositories`.
 *  - _init() starts the server; constructor only configures middleware/routes.
 */
export class ExpressApp {
    /** Mutable internally (middleware mounts reassign it); read-only to consumers via getter. */
    private _app: Application;
    private server: ReturnType<Application['listen']> | null = null;

    /** Public read-only surface for tests and supertest. */
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

    // ── private setup ──────────────────────────────────────────────────────

    private _mountLogger(): void {
        Logger._init();
        Logger.getInstance().info('Logger :: Mounted');
    }

    private _mountMiddlewares(): void {
        this._app = Http.mount(this._app);
        this._app = Morgan.mount(this._app);

        if (EnvConfig.getConfig().CORS_ENABLED) {
            this._app = CORS.mount(this._app);
        }

        this._app.use((_req: Request, res: Response, next: NextFunction) => {
            res.setHeader('X-Environment', EnvConfig.getConfig().NODE_ENV);
            res.setHeader('X-API-Version', '1.0.0');
            next();
        });

        this._app.use((req: Request, res: Response, next: NextFunction) => {
            if (EnvConfig.isServerMaintenance() && req.path !== '/health') {
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
        this._app = EnvConfig.init(this._app);
        this._app = SwaggerDocs.init(this._app);
    }

    /**
     * Inject the RepositoryFactory onto req.repoFactory.
     * Routes call req.repoFactory.getRepository('User') etc.
     */
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
        const cfg = EnvConfig.getConfig();
        const prefix = cfg.API_PREFIX ?? 'api';

        // ── probes ────────────────────────────────────────────────────────
        this._app.get('/health', async (_req: Request, res: Response) => {
            const dbHealth = this.db.isInitialized()
                ? await this.db.healthCheck()
                : { error: 'not initialized' };

            res.status(200).json({
                status: 'OK',
                environment: cfg.NODE_ENV,
                maintenance: cfg.SERVER_MAINTENANCE,
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

        // ── root ──────────────────────────────────────────────────────────
        this._app.get('/', (_req: Request, res: Response) => {
            const messages: Record<string, string> = {
                development: '🚀 Development Server - Social Media API',
                staging:     '🧪 Staging Server - Social Media API',
                production:  '🌍 Production Server - Social Media API',
                test:        '🧪 Test Server - Social Media API',
            };
            res.json({
                message: messages[cfg.NODE_ENV] ?? messages['development'],
                environment: cfg.NODE_ENV,
                version: '1.0.0',
                documentation: cfg.NODE_ENV !== 'production' ? '/api-docs' : 'https://docs.yourdomain.com',
                timestamp: new Date().toISOString(),
            });
        });

        this._app.get(`/${prefix}/environment`, (_req: Request, res: Response) => {
            res.json({
                environment: cfg.NODE_ENV,
                maintenance: cfg.SERVER_MAINTENANCE,
                apiUrl: EnvConfig.getApiUrl(),
                timestamp: new Date().toISOString(),
            });
        });

        // ── example resource route ────────────────────────────────────────
        this._app.get(`/${prefix}/users`, async (req: Request, res: Response): Promise<void> => {
            try {
                Monitoring.getInstance().incrementExternalApiCall('user_list');

                if (!req.repoFactory) {
                    res.status(503).json({ error: 'Database not ready' });
                    return;
                }

                const users = await req.repoFactory.getRepository('User').findMany({});
                res.json({ users });
            } catch (error) {
                Logger.getInstance().error(`Error fetching users: ${error}`);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        this._app.get(`/${prefix}/error`, (_req: Request, _res: Response) => {
            Monitoring.getInstance().recordError('TestError', `/${prefix}/error`);
            throw new Error('Test error for monitoring');
        });

        Logger.getInstance().info('Routes :: Mounted');
    }

    private _registerHandlers(): void {
        this._app.use(ExceptionHandler.logErrors);
        this._app.use(ExceptionHandler.clientErrorHandler);
        this._app.use(ExceptionHandler.errorHandler);
        this._app = ExceptionHandler.notFoundHandler(this._app);
    }

    // ── public lifecycle ───────────────────────────────────────────────────

    async _init(): Promise<void> {
        Logger.getInstance().info('Server :: Starting...');

        await this.db.initialize();

        const port = EnvConfig.getConfig().PORT;
        this.server = this._app.listen(port, () => {
            const c = EnvConfig.getConfig();
            Logger.getInstance().info(`🚀 Server running on ${EnvConfig.getApiUrl()}`);
            Logger.getInstance().info(`📦 Environment: ${c.NODE_ENV.toUpperCase()}`);
            Logger.getInstance().info(`🗄️  Database mode: active`);
        }).on('error', (err: Error) => {
            Logger.getInstance().error(`Server error: ${err.message}`);
        });

        this._setupGracefulShutdown();
        Logger.getInstance().info('App :: Started');
    }

    async _close(): Promise<void> {
        Logger.getInstance().info('Server :: Stopping...');
        await shutdownTelemetry();
        await this.db.shutdown();
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    Logger.getInstance().info('Server :: Stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    private _setupGracefulShutdown(): void {
        const shutdown = async (): Promise<void> => {
            Logger.getInstance().info('Shutting down gracefully...');
            await this._close();
            process.exit(0);
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }
}

export default ExpressApp;
