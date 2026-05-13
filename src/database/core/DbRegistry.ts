import type { DbType, DbMode, ModelDbMapping, ModelName } from '../../interfaces/core/db-types';

/**
 * DbRegistry holds the model → database routing table.
 *
 * It is a plain class — no static getInstance(), no global state.
 * Instantiate once in the composition root (database.config.ts) and
 * pass it wherever it is needed.
 */
export class DbRegistry {
    private readonly modelDbMap: Map<string, DbType> = new Map();
    private singleDbOverride: DbType | null = null;

    constructor(
        mapping: ModelDbMapping,
        private readonly defaultDb: DbType
    ) {
        for (const [model, dbType] of Object.entries(mapping)) {
            const resolved: DbType = dbType === 'default' ? defaultDb : (dbType as DbType);
            this.modelDbMap.set(model, resolved);
        }
    }

    /**
     * Returns the DbType for a given model name.
     * In single-DB mode returns the override for every model.
     */
    getDbForModel(modelName: ModelName | string): DbType {
        if (this.singleDbOverride) return this.singleDbOverride;
        return this.modelDbMap.get(modelName) ?? this.defaultDb;
    }

    getDefaultDb(): DbType {
        return this.singleDbOverride ?? this.defaultDb;
    }

    getMode(): DbMode {
        return this.singleDbOverride ? 'single' : 'split';
    }

    /**
     * Switch all models to a single DB without rebuilding the registry.
     * Used at startup when DB_MODE=single.
     */
    enableSingleMode(dbType: DbType): void {
        this.singleDbOverride = dbType;
    }

    disableSingleMode(): void {
        this.singleDbOverride = null;
    }
}
