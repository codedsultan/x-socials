/**
 * Main Application Entry Point
 */
import "./instrumentation";
import ExpressApp from "./app";
import Logger from "./logger";

const main = (): void => {
    // Run the Server
    Logger.getInstance().info("App :: Starting...");
    Logger.getInstance().info(`App :: Environment: ${process.env.NODE_ENV || "development"}`);

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

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
    Logger.getInstance().error(`Uncaught Exception: ${error.message}`);
    Logger.getInstance().error(error.stack || "");

    // Graceful shutdown
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
    Logger.getInstance().error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);

    // Graceful shutdown
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});