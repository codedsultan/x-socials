// src/database/initializer.ts
import DatabaseConfig from '../config/database.config';
import EnvConfig from '../config/env';
import Logger from '../logger';

export class DatabaseInitializer {
    private static initialized = false;

    static async initialize(): Promise<void> {
        if (this.initialized) {
            Logger.getInstance().info('Database already initialized');
            return;
        }

        try {
            Logger.getInstance().info('Database :: Initializing...');

            // Get database configuration from EnvConfig
            const envConfig = EnvConfig.getConfig();

            // Initialize database with config
            await DatabaseConfig.initialize();

            // Log which databases are available
            const configuredDbs: string[] = [];
            if (envConfig.MONGO_URI) configuredDbs.push('MongoDB');
            if (envConfig.PG_HOST && envConfig.PG_DATABASE) configuredDbs.push('PostgreSQL');
            if (envConfig.MYSQL_HOST && envConfig.MYSQL_DATABASE) configuredDbs.push('MySQL');
            if (envConfig.SQLITE_FILENAME) configuredDbs.push('SQLite');

            Logger.getInstance().info(`Database :: Initialized with: ${configuredDbs.join(', ') || 'none'}`);
            // Logger.getInstance().info(`Database :: Mode: ${DatabaseConfig.getCurrentDbMode()}`);
            Logger.getInstance().info(`Database :: Default DB: ${EnvConfig.getDefaultDb()}`);

            this.initialized = true;
        } catch (error) {
            Logger.getInstance().error(`Database :: Initialization failed: ${error}`);
            throw error;
        }
    }

    static async shutdown(): Promise<void> {
        if (!this.initialized) return;

        Logger.getInstance().info('Database :: Shutting down...');
        await DatabaseConfig.shutdown();
        this.initialized = false;
        Logger.getInstance().info('Database :: Shutdown complete');
    }

    static async healthCheck(): Promise<Record<string, boolean>> {
        return DatabaseConfig.healthCheck();
    }

    static isInitialized(): boolean {
        return this.initialized;
    }
}