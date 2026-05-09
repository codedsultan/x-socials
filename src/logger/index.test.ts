import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import winston from "winston";
import Logger from "./index";

describe("Logger", () => {
    let consoleSpy: any;

    beforeEach(() => {
        // Reset the singleton instance before each test
        (Logger as any).instance = null;  // Changed from undefined to null
        consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    describe("getInstance", () => {
        it("should return a winston logger instance", () => {
            const logger = Logger.getInstance();

            expect(logger).toBeDefined();
            expect(logger).toHaveProperty("info");
            expect(logger).toHaveProperty("error");
            expect(logger).toHaveProperty("warn");
            expect(logger).toHaveProperty("debug");
        });

        it("should return the same instance (singleton pattern)", () => {
            const instance1 = Logger.getInstance();
            const instance2 = Logger.getInstance();

            expect(instance1).toBe(instance2);
        });
    });

    describe("_init", () => {
        it("should reinitialize the logger instance and return it", () => {
            const firstInstance = Logger.getInstance();
            const newInstance = Logger._init();  // Now returns the new instance

            // Should return a new instance
            expect(firstInstance).not.toBe(newInstance);
            expect(newInstance).toBeInstanceOf(winston.Logger);
        });

        it("should return a configured logger instance", () => {
            const logger = Logger._init();

            expect(logger).toBeDefined();
            expect(logger.level).toBe("debug");
        });
    });

    describe("_reset", () => {
        it("should reset the singleton instance", () => {
            const instance1 = Logger.getInstance();
            Logger._reset();
            const instance2 = Logger.getInstance();

            expect(instance1).not.toBe(instance2);
        });
    });

    describe("Logging methods", () => {
        it("should log info messages", () => {
            const logger = Logger.getInstance();
            const infoSpy = vi.spyOn(logger, "info");

            logger.info("Test info message");

            expect(infoSpy).toHaveBeenCalledWith("Test info message");
        });

        it("should log error messages", () => {
            const logger = Logger.getInstance();
            const errorSpy = vi.spyOn(logger, "error");

            logger.error("Test error message");

            expect(errorSpy).toHaveBeenCalledWith("Test error message");
        });

        it("should log warn messages", () => {
            const logger = Logger.getInstance();
            const warnSpy = vi.spyOn(logger, "warn");

            logger.warn("Test warn message");

            expect(warnSpy).toHaveBeenCalledWith("Test warn message");
        });

        it("should log debug messages", () => {
            const logger = Logger.getInstance();
            const debugSpy = vi.spyOn(logger, "debug");

            logger.debug("Test debug message");

            expect(debugSpy).toHaveBeenCalledWith("Test debug message");
        });

        it("should log objects", () => {
            const logger = Logger.getInstance();
            const infoSpy = vi.spyOn(logger, "info");

            const testObject = { name: "Test", value: 123 };
            logger.info(testObject);

            expect(infoSpy).toHaveBeenCalledWith(testObject);
        });
    });

    describe("Log formatting", () => {
        it("should include timestamp in development environment", () => {
            process.env.NODE_ENV = "development";
            (Logger as any).instance = undefined;

            const logger = Logger.getInstance();
            const writeSpy = vi.spyOn(process.stdout, "write");

            logger.info("Test message");

            // Give time for async logging
            setTimeout(() => {
                const output = writeSpy.mock.calls[0][0];
                expect(output).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}:\d{3}\]/);
                expect(output).toContain("info");
                expect(output).toContain("Test message");
            }, 100);
        });

        it("should not include colors in production environment", () => {
            process.env.NODE_ENV = "production";
            (Logger as any).instance = undefined;

            const logger = Logger.getInstance();
            const writeSpy = vi.spyOn(process.stdout, "write");

            logger.info("Test message");

            setTimeout(() => {
                const output = writeSpy.mock.calls[0][0];
                // Should not have color codes in production
                expect(output).not.toContain("\u001b");
            }, 100);
        });
    });

    describe("Error handling", () => {
        it("should handle logging errors without crashing", () => {
            const logger = Logger.getInstance();

            expect(() => {
                logger.error(new Error("Test error"));
            }).not.toThrow();
        });

        it("should log error stacks when provided", () => {
            const logger = Logger.getInstance();
            const errorSpy = vi.spyOn(logger, "error");
            const error = new Error("Test error");

            logger.error(error);

            expect(errorSpy).toHaveBeenCalledWith(error);
        });
    });
});