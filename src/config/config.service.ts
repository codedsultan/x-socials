import { IAppConfig, IEnvConfig, IDatabaseConfig } from '../interfaces/core/config';
import { ServerConfigBuilder } from './builders/server.config.builder';
import { DatabaseConfigBuilder } from './builders/database.config.builder';
import Logger from '../logger';
import winston from 'winston';

export class ConfigService {
    private static instance: ConfigService;
    private config: IAppConfig;
    private logger: winston.Logger;

    private constructor() {
        this.logger = Logger.getInstance();
        this.config = this.loadConfig();
    }

    public static getInstance(): ConfigService {
        if (!ConfigService.instance) {
            ConfigService.instance = new ConfigService();
        }
        return ConfigService.instance;
    }

    // Returns IEnvConfig for backward compatibility
    public getServerConfig(): IEnvConfig {
        return this.config.server;
    }

    public getDatabaseConfig(): IDatabaseConfig {
        return this.config.databases;
    }

    public getFullConfig(): IAppConfig {
        return this.config;
    }

    private loadConfig(): IAppConfig {
        const serverBuilder = new ServerConfigBuilder(this.logger);
        const dbBuilder = new DatabaseConfigBuilder(this.logger);

        const config = {
            server: serverBuilder.build(),
            databases: dbBuilder.build(),
        };

        this.logger.info('ConfigService initialized successfully');
        return config;
    }

    // Convenience methods (backward compatible)
    public isProduction(): boolean {
        return this.config.server.NODE_ENV === 'production';
    }

    public isDevelopment(): boolean {
        return this.config.server.NODE_ENV === 'development';
    }

    public isStaging(): boolean {
        return this.config.server.NODE_ENV === 'staging';
    }

    public isTest(): boolean {
        return this.config.server.NODE_ENV === 'test';
    }

    public isServerMaintenance(): boolean {
        return this.config.server.SERVER_MAINTENANCE;
    }

    public isSwaggerEnabled(): boolean {
        return this.config.server.ENABLE_SWAGGER;
    }

    public getDefaultDb(): string {
        return this.config.databases.defaultDb;
    }

    // For testing purposes only
    public static resetInstance(): void {
        ConfigService.instance = null as any;
    }
}

// Export singleton instance
export default ConfigService.getInstance();