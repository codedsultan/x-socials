import { DbRegistry } from './DbRegistry';
import { ModelName, DbType } from '../../interfaces/core/db-types';
import { IDatabaseAdapter } from '../../interfaces/db/IAdapter';
import { MongooseAdapter } from '../adapters/MongooseAdapter';
import { KnexAdapter } from '../adapters/KnexAdapter';
import { IDatabaseConfig } from '../../interfaces/core/config';

export class DbResolver {
    private adapters: Map<DbType, IDatabaseAdapter> = new Map();
    private registry = DbRegistry.getInstance();

    constructor(configs: IDatabaseConfig) {
        // Initialize adapters based on available configs
        if (configs.mongodb) {
            this.adapters.set('mongodb', new MongooseAdapter(configs.mongodb));
        }
        if (configs.postgres) {
            this.adapters.set('postgres', new KnexAdapter(configs.postgres));
        }
        if (configs.mysql) {
            this.adapters.set('mysql', new KnexAdapter(configs.mysql));
        }
        if (configs.sqlite) {
            this.adapters.set('sqlite', new KnexAdapter(configs.sqlite));
        }
    }

    async initializeAll(): Promise<void> {
        const connections = Array.from(this.adapters.values()).map(a => a.connect());
        await Promise.all(connections);
    }

    async disconnectAll(): Promise<void> {
        const disconnections = Array.from(this.adapters.values()).map(a => a.disconnect());
        await Promise.all(disconnections);
    }

    getAdapterForModel(modelName: ModelName | string): IDatabaseAdapter {
        const dbType = this.registry.getDbForModel(modelName);
        const adapter = this.adapters.get(dbType);
        if (!adapter) {
            throw new Error(`No adapter configured for database type: ${dbType}`);
        }
        return adapter;
    }

    getAdapter(dbType: DbType): IDatabaseAdapter | undefined {
        return this.adapters.get(dbType);
    }

    // For switching to single DB mode
    enableSingleDbMode(dbType: DbType): void {
        this.registry.setSingleDbMode(dbType);
    }
}