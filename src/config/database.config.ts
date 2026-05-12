import ConfigService from './config.service';
import { RepositoryFactory } from '../factories/RepositoryFactory';
import { ModelSchemas } from '../models/schemas';
import Logger from '../logger';

import EnvConfig from './env';
import { ModelDbMapping } from '../interfaces/core/db-types';
import { DbRegistry } from '../database/core/DbRegistry';
import { DbResolver } from '../database/core/DbResolver';

// Model to database mapping configuration - Use proper type
const MODEL_DB_MAPPING: ModelDbMapping = {
    User: 'postgres',
    Otp: 'postgres',
    Token: 'postgres',
    Post: 'mongodb',
    Comment: 'mongodb',
    Like: 'mongodb',
};

class DatabaseConfig {
    private static instance: DatabaseConfig | null = null;
    private dbResolver: DbResolver | null = null;
    private repoFactory: RepositoryFactory | null = null;
    private isInitialized = false;

    private constructor() { }

    public static getInstance(): DatabaseConfig {
        if (!DatabaseConfig.instance) {
            DatabaseConfig.instance = new DatabaseConfig();
        }
        return DatabaseConfig.instance;
    }

    public async initialize(): Promise<{ dbResolver: DbResolver; repoFactory: RepositoryFactory }> {
        if (this.isInitialized) {
            Logger.getInstance().warn('Database already initialized');
            return { dbResolver: this.dbResolver!, repoFactory: this.repoFactory! };
        }

        try {
            // Use backward-compatible EnvConfig
            const envConfig = EnvConfig.getConfig();
            const defaultDb = EnvConfig.getDefaultDb() as 'mongodb' | 'postgres' | 'mysql' | 'sqlite';

            // Get structured DB config from ConfigService (new way)
            const dbConfig = ConfigService.getDatabaseConfig();

            Logger.getInstance().info(`Database Config :: Initializing with default DB: ${defaultDb} (${envConfig.NODE_ENV} mode)`);

            // Configure registry
            const registry = DbRegistry.getInstance();
            registry.configure(MODEL_DB_MAPPING, defaultDb);

            // Initialize resolver with structured config
            this.dbResolver = new DbResolver(dbConfig);
            await this.dbResolver.initializeAll();

            // Register models
            for (const [modelName, schema] of Object.entries(ModelSchemas)) {
                const adapter = this.dbResolver.getAdapterForModel(modelName);
                if (adapter && typeof adapter.registerModel === 'function') {
                    adapter.registerModel(modelName, schema);
                }
            }

            this.repoFactory = RepositoryFactory.getInstance(this.dbResolver);
            this.isInitialized = true;

            Logger.getInstance().info('Database Config :: Successfully initialized');

            return { dbResolver: this.dbResolver, repoFactory: this.repoFactory };
        } catch (error) {
            Logger.getInstance().error('Database initialization failed:', error);
            throw error;
        }
    }

    public getDbResolver(): DbResolver {
        if (!this.dbResolver || !this.isInitialized) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.dbResolver;
    }

    public getRepositoryFactory(): RepositoryFactory {
        if (!this.repoFactory || !this.isInitialized) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.repoFactory;
    }

    public async healthCheck(): Promise<Record<string, boolean>> {
        if (!this.dbResolver || !this.isInitialized) {
            throw new Error('Database not initialized. Call initialize() first.');
        }

        const health: Record<string, boolean> = {};
        const dbTypes: Array<'mongodb' | 'postgres' | 'mysql' | 'sqlite'> = ['mongodb', 'postgres', 'mysql', 'sqlite'];

        for (const dbType of dbTypes) {
            try {
                const adapter = this.dbResolver.getAdapter(dbType);
                health[dbType] = adapter ? await adapter.isConnected() : false;
            } catch (error) {
                health[dbType] = false;
            }
        }

        return health;
    }

    public async shutdown(): Promise<void> {
        Logger.getInstance().info('Database Config :: Shutting down...');

        if (this.dbResolver && typeof this.dbResolver.disconnectAll === 'function') {
            await this.dbResolver.disconnectAll();
        }

        this.dbResolver = null;
        this.repoFactory = null;
        this.isInitialized = false;
    }
}

// Backward compatible exports
export default DatabaseConfig.getInstance();
export const initializeDatabase = () => DatabaseConfig.getInstance().initialize();
export const getDbResolver = () => DatabaseConfig.getInstance().getDbResolver();
export const getRepositoryFactory = () => DatabaseConfig.getInstance().getRepositoryFactory();
export const healthCheck = () => DatabaseConfig.getInstance().healthCheck();
export const shutdownDatabases = () => DatabaseConfig.getInstance().shutdown();