import { DbType, ModelDbMapping, ModelName } from '../../interfaces/core/db-types';

export class DbRegistry {
    private static instance: DbRegistry;
    private modelDbMap: Map<string, DbType> = new Map();
    private defaultDb!: DbType;

    private constructor() { }

    static getInstance(): DbRegistry {
        if (!DbRegistry.instance) {
            DbRegistry.instance = new DbRegistry();
        }
        return DbRegistry.instance;
    }

    configure(mapping: ModelDbMapping, defaultDb: DbType): void {
        this.defaultDb = defaultDb;
        for (const [model, dbType] of Object.entries(mapping)) {
            // Handle both direct DbType or 'default' string
            const resolvedDbType = dbType === 'default' ? defaultDb : dbType;
            this.modelDbMap.set(model, resolvedDbType as DbType);
        }
    }

    getDbForModel(modelName: ModelName | string): DbType {
        if (!this.defaultDb) {
            throw new Error('DbRegistry not configured. Call configure() first.');
        }
        return this.modelDbMap.get(modelName) || this.defaultDb;
    }

    // For single DB mode - override everything to one DB
    setSingleDbMode(dbType: DbType): void {
        // Clear existing mappings and set all to the single DB type
        this.modelDbMap.clear();
        this.defaultDb = dbType;
    }
}