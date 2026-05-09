import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import swaggerJsdoc from "swagger-jsdoc";
import EnvConfig from "./env";
import SwaggerDocs from "./swagger";

// Define the OpenAPI spec type for testing
interface OpenAPISpec {
    openapi: string;
    info: {
        title: string;
        version: string;
        description?: string;
    };
    [key: string]: any;
}

// Mock swagger-ui-express
vi.mock("swagger-ui-express", () => ({
    default: {
        serve: [vi.fn(), vi.fn()],
        setup: vi.fn(() => [vi.fn()])
    }
}));

vi.mock("swagger-jsdoc", () => ({
    default: vi.fn(() => ({
        openapi: "3.0.0",
        info: {
            title: "Test API",
            version: "1.0.0"
        }
    }))
}));

vi.mock("./env", () => ({
    default: {
        getConfig: vi.fn(),
        isProduction: vi.fn(),
        isDevelopment: vi.fn(),
        isStaging: vi.fn(),
        getApiUrl: vi.fn(),
    }
}));

describe("SwaggerDocs", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock returns
        (EnvConfig.getConfig as any).mockReturnValue({
            PORT: 5000,
            NODE_ENV: "development",
        });
        (EnvConfig.isProduction as any).mockReturnValue(false);
        (EnvConfig.isDevelopment as any).mockReturnValue(true);
        (EnvConfig.isStaging as any).mockReturnValue(false);
        (EnvConfig.getApiUrl as any).mockReturnValue("http://localhost:5000");

        // Reset process.env
        delete process.env.ENABLE_SWAGGER;
        delete process.env.EXTERNAL_DOCS_URL;

        // Reset the static swaggerSpecs
        (SwaggerDocs as any).swaggerSpecs = null;
    });

    describe("init", () => {
        it("should initialize swagger in development", () => {
            const mockApp = {
                use: vi.fn(),
                get: vi.fn(),
            } as any;

            SwaggerDocs.init(mockApp);

            // Check that swagger was initialized (use was called)
            expect(mockApp.use).toHaveBeenCalled();
            expect(mockApp.use.mock.calls[0][0]).toBe("/api-docs");
            expect(mockApp.get).toHaveBeenCalledWith("/api-docs.json", expect.any(Function));
        });

        it("should not initialize swagger in production", () => {
            (EnvConfig.isProduction as any).mockReturnValue(true);
            (EnvConfig.isDevelopment as any).mockReturnValue(false);
            process.env.ENABLE_SWAGGER = "false";

            const mockApp = {
                use: vi.fn(),
                get: vi.fn(),
            } as any;

            SwaggerDocs.init(mockApp);

            // Swagger should not be initialized (use not called with /api-docs)
            const apiDocsCalls = mockApp.use.mock.calls.filter(
                (call: any[]) => call[0] === "/api-docs"
            );
            expect(apiDocsCalls).toHaveLength(0);
        });

        it("should force enable swagger in production with ENABLE_SWAGGER flag", () => {
            (EnvConfig.isProduction as any).mockReturnValue(true);
            (EnvConfig.isDevelopment as any).mockReturnValue(false);
            process.env.ENABLE_SWAGGER = "true";

            const mockApp = {
                use: vi.fn(),
                get: vi.fn(),
            } as any;

            SwaggerDocs.init(mockApp);

            // Swagger should be initialized
            expect(mockApp.use).toHaveBeenCalled();
            expect(mockApp.use.mock.calls[0][0]).toBe("/api-docs");
        });

        it("should redirect to external docs in production when enabled", () => {
            (EnvConfig.isProduction as any).mockReturnValue(true);
            (EnvConfig.isDevelopment as any).mockReturnValue(false);
            process.env.ENABLE_SWAGGER = "false";
            process.env.EXTERNAL_DOCS_URL = "https://docs.example.com";

            const mockApp = {
                use: vi.fn(),
                get: vi.fn(),
            } as any;

            SwaggerDocs.init(mockApp);

            // Should set up redirect for /api-docs
            expect(mockApp.get).toHaveBeenCalledWith("/api-docs", expect.any(Function));
        });
    });

    describe("getSpecs", () => {
        it("should return swagger specifications", () => {
            // Reset the mock to ensure it's called
            vi.mocked(swaggerJsdoc).mockClear();

            const specs = SwaggerDocs.getSpecs() as OpenAPISpec;

            expect(specs).toBeDefined();
            expect(specs.openapi).toBe("3.0.0");
            expect(specs.info).toBeDefined();
            expect(specs.info.title).toBe("Test API");
        });

        it("should return cached specifications on subsequent calls", () => {
            const specs1 = SwaggerDocs.getSpecs() as OpenAPISpec;
            const specs2 = SwaggerDocs.getSpecs() as OpenAPISpec;

            expect(specs1).toBe(specs2);
        });
    });
});