"use strict";
/**
 * Define Logger
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
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
winston_1.default.addColors(colors);
// Define format of the Logger
let _consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }), winston_1.default.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] ${level}: ${message}`;
}));
if (process.env.NODE_ENV !== "development") {
    _consoleFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }), winston_1.default.format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] ${level}: ${message}`;
    }));
}
// Define transports of the Logger
const transports = [
    new winston_1.default.transports.Console({
        handleExceptions: true,
        format: _consoleFormat,
    }),
];
class Logger {
    static instance = null;
    constructor() { }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = winston_1.default.createLogger({
                level: "debug",
                levels,
                transports,
            });
        }
        return Logger.instance;
    }
    // FIXED: Now returns winston.Logger instead of void
    static _init() {
        Logger.instance = winston_1.default.createLogger({
            level: "debug",
            levels,
            transports,
        });
        return Logger.instance;
    }
    // Optional: Reset method for testing
    static _reset() {
        Logger.instance = null;
    }
}
exports.default = Logger;
//# sourceMappingURL=index.js.map