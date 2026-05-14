// src/database/initializer.ts
import type { IDatabaseConfig } from '../interfaces/core/config';
import type { DatabaseContainer } from '../config/database.config';
import { buildDatabaseContainer, checkDatabaseHealth } from '../config/database.config';
import Logger from '../logger';

export class DatabaseInitializer {
    private container: DatabaseContainer | null = null;
    private initialized = false;

    constructor(private readonly dbConfig: IDatabaseConfig) { }

    async initialize(options?: { skipMigrations?: boolean }): Promise<void> {
        if (this.initialized) {
            Logger.getInstance().info('DatabaseInitializer :: already initialized');
            return;
        }

        Logger.getInstance().info('DatabaseInitializer :: starting...');
        this.container = await buildDatabaseContainer(this.dbConfig, options);
        this.initialized = true;
        Logger.getInstance().info('DatabaseInitializer :: ready');
    }

    async shutdown(): Promise<void> {
        if (!this.initialized || !this.container) return;

        Logger.getInstance().info('DatabaseInitializer :: shutting down...');
        await this.container.resolver.disconnectAll();
        this.container = null;
        this.initialized = false;
        Logger.getInstance().info('DatabaseInitializer :: shutdown complete');
    }

    async healthCheck(): Promise<Record<string, boolean>> {
        if (!this.container || !this.initialized) return {};
        return checkDatabaseHealth(this.container.resolver);
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    getContainer(): DatabaseContainer {
        if (!this.container || !this.initialized) {
            throw new Error('DatabaseInitializer: not initialized. Call initialize() first.');
        }
        return this.container;
    }
}