"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseInitializer = void 0;
const database_config_1 = require("../config/database.config");
const logger_1 = __importDefault(require("../logger"));
class DatabaseInitializer {
    dbConfig;
    container = null;
    initialized = false;
    constructor(dbConfig) {
        this.dbConfig = dbConfig;
    }
    async initialize(options) {
        if (this.initialized) {
            logger_1.default.getInstance().info('DatabaseInitializer :: already initialized');
            return;
        }
        logger_1.default.getInstance().info('DatabaseInitializer :: starting...');
        this.container = await (0, database_config_1.buildDatabaseContainer)(this.dbConfig, options);
        this.initialized = true;
        logger_1.default.getInstance().info('DatabaseInitializer :: ready');
    }
    async shutdown() {
        if (!this.initialized || !this.container)
            return;
        logger_1.default.getInstance().info('DatabaseInitializer :: shutting down...');
        await this.container.resolver.disconnectAll();
        this.container = null;
        this.initialized = false;
        logger_1.default.getInstance().info('DatabaseInitializer :: shutdown complete');
    }
    async healthCheck() {
        if (!this.container || !this.initialized)
            return {};
        return (0, database_config_1.checkDatabaseHealth)(this.container.resolver);
    }
    isInitialized() {
        return this.initialized;
    }
    getContainer() {
        if (!this.container || !this.initialized) {
            throw new Error('DatabaseInitializer: not initialized. Call initialize() first.');
        }
        return this.container;
    }
}
exports.DatabaseInitializer = DatabaseInitializer;
//# sourceMappingURL=initializer.js.map