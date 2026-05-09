/**
 * Main Application Entry Point
 */

import ExpressApp from "./app";
import Logger from "./logger";

const main = (): void => {
    // Run the Server
    Logger.getInstance().info("App :: Starting...");

    // Initialize Express App (starts the server)
    ExpressApp._init();
};

/**
 * Booting MainApp
 */
main();

// Handle graceful shutdown
process.on("SIGINT", () => {
    Logger.getInstance().info("App :: Shutting down gracefully...");
    process.exit(0);
});

process.on("SIGTERM", () => {
    Logger.getInstance().info("App :: Shutting down gracefully...");
    process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
    Logger.getInstance().error(`Uncaught Exception: ${error.message}`);
    Logger.getInstance().error(error.stack || "");
    process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
    Logger.getInstance().error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    process.exit(1);
});