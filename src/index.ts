/**
 * Application entry point — composition root.
 *
 * All objects are wired here explicitly. Nothing reaches for getInstance()
 * chains mid-graph. Dependencies flow down via constructors.
 */

import dotenv from 'dotenv';
dotenv.config();
import './instrumentation';
import { ExpressApp } from './app';
import { DatabaseInitializer } from './database/initializer';
import ConfigService from './config/config.service';
import Logger from './logger';

const main = async (): Promise<void> => {
    const logger = Logger.getInstance();
    logger.info('App :: Starting...');
    logger.info(`App :: Environment: ${process.env['NODE_ENV'] ?? 'development'}`);

    try {
        // Wire the object graph — all dependencies explicit
        const dbConfig = ConfigService.getDatabaseConfig();
        const db = new DatabaseInitializer(dbConfig);
        const app = new ExpressApp(db);

        await app._init();
        logger.info('App :: Successfully started');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`App :: Failed to start: ${errorMessage}`);
        process.exit(1);
    }
};

process.on('uncaughtException', (error: Error) => {
    Logger.getInstance().error(`Uncaught Exception: ${error.message}\n${error.stack ?? ''}`);
    setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    Logger.getInstance().error(`Unhandled Rejection: ${error.message}\n${error.stack ?? ''}`);
    setTimeout(() => process.exit(1), 1000);
});

process.on('warning', (warning: Error) =>
    Logger.getInstance().warn(`Warning: ${warning.message}`)
);

main();