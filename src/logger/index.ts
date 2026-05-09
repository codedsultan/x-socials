/**
 * Define Logger
 */

import winston from "winston";

// Define your severity levels.
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define different colors for each level.
const colors = {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    debug: "white",
};

// Link colors of the log levels.
winston.addColors(colors);

// Define format of the Logger
let _consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
    winston.format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] ${level}: ${message}`;
    })
);

if (process.env.NODE_ENV !== "development") {
    _consoleFormat = winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
        winston.format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] ${level}: ${message}`;
        })
    );
}

// Define transports of the Logger
const transports: winston.transport[] = [
    new winston.transports.Console({
        handleExceptions: true,
        format: _consoleFormat,
    }),
];

class Logger {
    private static instance: winston.Logger | null = null;
    private constructor() { }

    public static getInstance(): winston.Logger {
        if (!Logger.instance) {
            Logger.instance = winston.createLogger({
                level: "debug",
                levels,
                transports,
            });
        }
        return Logger.instance;
    }

    // FIXED: Now returns winston.Logger instead of void
    public static _init(): winston.Logger {
        Logger.instance = winston.createLogger({
            level: "debug",
            levels,
            transports,
        });
        return Logger.instance;
    }

    // Optional: Reset method for testing
    public static _reset(): void {
        Logger.instance = null;
    }
}

export default Logger;