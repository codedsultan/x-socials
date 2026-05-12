/**
 * Main Application Entry Point
 */
import "./instrumentation";
import ExpressApp from "./app";
import Logger from "./logger";

const main = async (): Promise<void> => {
    try {
        // Run the Server
        Logger.getInstance().info("App :: Starting...");
        Logger.getInstance().info(`App :: Environment: ${process.env.NODE_ENV || "development"}`);

        // Initialize Express App (starts the server with database)
        await ExpressApp._init();

        Logger.getInstance().info("App :: Successfully started");
    } catch (error) {
        Logger.getInstance().error(`App :: Failed to start: ${error}`);
        process.exit(1);
    }
};

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal: string): Promise<void> => {
    Logger.getInstance().info(`App :: Received ${signal}, shutting down gracefully...`);

    try {
        // Close Express app (which will also close database connections)
        await ExpressApp._close();
        Logger.getInstance().info("App :: Shutdown complete");
        process.exit(0);
    } catch (error) {
        Logger.getInstance().error(`App :: Error during shutdown: ${error}`);
        process.exit(1);
    }
};

/**
 * Error handling shutdown - faster exit for errors
 */
const errorShutdown = (error: Error, source: string): void => {
    Logger.getInstance().error(`${source}: ${error.message}`);
    Logger.getInstance().error(error.stack || "");

    // Give logs time to write, then exit
    setTimeout(() => {
        process.exit(1);
    }, 1000);
};

// Handle graceful shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
    errorShutdown(error, "Uncaught Exception");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    errorShutdown(error, "Unhandled Rejection");
});

// Handle warnings (optional - log but don't crash)
process.on("warning", (warning: Error) => {
    Logger.getInstance().warn(`Warning: ${warning.message}`);
});

/**
 * Booting MainApp
 */
main();