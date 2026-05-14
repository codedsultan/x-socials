"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbRegistry = void 0;
/**
 * DbRegistry holds the model → database routing table.
 *
 * It is a plain class — no static getInstance(), no global state.
 * Instantiate once in the composition root (database.config.ts) and
 * pass it wherever it is needed.
 */
class DbRegistry {
    defaultDb;
    modelDbMap = new Map();
    singleDbOverride = null;
    constructor(mapping, defaultDb) {
        this.defaultDb = defaultDb;
        for (const [model, dbType] of Object.entries(mapping)) {
            const resolved = dbType === 'default' ? defaultDb : dbType;
            this.modelDbMap.set(model, resolved);
        }
    }
    /**
     * Returns the DbType for a given model name.
     * In single-DB mode returns the override for every model.
     */
    getDbForModel(modelName) {
        if (this.singleDbOverride)
            return this.singleDbOverride;
        return this.modelDbMap.get(modelName) ?? this.defaultDb;
    }
    getDefaultDb() {
        return this.singleDbOverride ?? this.defaultDb;
    }
    getMode() {
        return this.singleDbOverride ? 'single' : 'split';
    }
    /**
     * Switch all models to a single DB without rebuilding the registry.
     * Used at startup when DB_MODE=single.
     */
    enableSingleMode(dbType) {
        this.singleDbOverride = dbType;
    }
    disableSingleMode() {
        this.singleDbOverride = null;
    }
}
exports.DbRegistry = DbRegistry;
//# sourceMappingURL=DbRegistry.js.map