import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import swaggerJsdoc from "swagger-jsdoc";
import SwaggerDocs from "./swagger";
import ConfigService from "../config/config.service";

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

// Mock ConfigService
vi.mock("../config/config.service", () => {
    // Create mock functions that can be accessed
    const mockIsSwaggerEnabled = vi.fn(() => true);
    const mockIsProduction = vi.fn(() => false);
    const mockIsDevelopment = vi.fn(() => true);
    const mockIsStaging = vi.fn(() => false);
    const mockGetServerConfig = vi.fn(() => ({
        PORT: 5000,
        NODE_ENV: "development",
        ENABLE_SWAGGER: true,
        API_PREFIX: "/api",
    }));
    const mockGetApiUrl = vi.fn(() => "http://localhost:5000");
    const mockGetPort = vi.fn(() => 5000);
    const mockGetNodeEnv = vi.fn(() => "development");
    const mockGetFullConfig = vi.fn(() => ({
        server: {
            PORT: 5000,
            NODE_ENV: "development",
            ENABLE_SWAGGER: true,
            API_PREFIX: "/api",
        },
        databases: {}
    }));

    return {
        default: {
            getInstance: vi.fn(() => ({
                isSwaggerEnabled: mockIsSwaggerEnabled,
                isProduction: mockIsProduction,
                isDevelopment: mockIsDevelopment,
                isStaging: mockIsStaging,
                getServerConfig: mockGetServerConfig,
                getApiUrl: mockGetApiUrl,
                getPort: mockGetPort,
                getNodeEnv: mockGetNodeEnv,
                getFullConfig: mockGetFullConfig,
            })),
            // Static methods
            isSwaggerEnabled: mockIsSwaggerEnabled,
            isProduction: mockIsProduction,
            isDevelopment: mockIsDevelopment,
            isStaging: mockIsStaging,
            getServerConfig: mockGetServerConfig,
            getApiUrl: mockGetApiUrl,
            getPort: mockGetPort,
            getNodeEnv: mockGetNodeEnv,
            getFullConfig: mockGetFullConfig,
        },
        __esModule: true,
    };
});

describe("SwaggerDocs", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Reset process.env
        delete process.env.ENABLE_SWAGGER;
        delete process.env.EXTERNAL_DOCS_URL;

        // Reset the static swaggerSpecs
        (SwaggerDocs as any).swaggerSpecs = null;

        // Reset ConfigService mocks to default values
        const configService = ConfigService as any;
        configService.isSwaggerEnabled.mockReturnValue(true);
        configService.isProduction.mockReturnValue(false);
        configService.isDevelopment.mockReturnValue(true);
        configService.isStaging.mockReturnValue(false);
        configService.getServerConfig.mockReturnValue({
            PORT: 5000,
            NODE_ENV: "development",
            ENABLE_SWAGGER: true,
            API_PREFIX: "/api",
        });
        configService.getApiUrl.mockReturnValue("http://localhost:5000");
        configService.getPort.mockReturnValue(5000);
        configService.getNodeEnv.mockReturnValue("development");
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("init", () => {
        it("should initialize swagger in development", () => {
            // Set up mocks for this test
            const configService = ConfigService as any;
            configService.isSwaggerEnabled.mockReturnValue(true);
            configService.isProduction.mockReturnValue(false);
            configService.isDevelopment.mockReturnValue(true);

            const mockApp = {
                use: vi.fn(),
                get: vi.fn(),
            } as any;

            SwaggerDocs.init(mockApp);

            // Check that swagger was initialized
            expect(configService.isSwaggerEnabled).toHaveBeenCalled();
            expect(mockApp.use).toHaveBeenCalled();
            expect(mockApp.use.mock.calls[0][0]).toBe("/api-docs");
            expect(mockApp.get).toHaveBeenCalledWith("/api-docs.json", expect.any(Function));
        });

        it("should not initialize swagger in production", () => {
            const configService = ConfigService as any;
            configService.isProduction.mockReturnValue(true);
            configService.isDevelopment.mockReturnValue(false);
            configService.isSwaggerEnabled.mockReturnValue(false);

            const mockApp = {
                use: vi.fn(),
                get: vi.fn(),
            } as any;

            SwaggerDocs.init(mockApp);

            // Verify isSwaggerEnabled was called
            expect(configService.isSwaggerEnabled).toHaveBeenCalled();

            // Swagger should not be initialized
            const apiDocsCalls = mockApp.use.mock.calls.filter(
                (call: any[]) => call[0] === "/api-docs"
            );
            expect(apiDocsCalls).toHaveLength(0);
        });

        it("should force enable swagger in production with ENABLE_SWAGGER flag", () => {
            const configService = ConfigService as any;
            configService.isProduction.mockReturnValue(true);
            configService.isDevelopment.mockReturnValue(false);
            configService.isSwaggerEnabled.mockReturnValue(true);

            // Set environment variable
            process.env.ENABLE_SWAGGER = "true";

            const mockApp = {
                use: vi.fn(),
                get: vi.fn(),
            } as any;

            SwaggerDocs.init(mockApp);

            // Verify isSwaggerEnabled was called and returned true
            expect(configService.isSwaggerEnabled).toHaveBeenCalled();
            expect(configService.isSwaggerEnabled.mock.results[0]?.value).toBe(true);

            // Swagger should be initialized
            expect(mockApp.use).toHaveBeenCalled();
            expect(mockApp.use.mock.calls[0][0]).toBe("/api-docs");
        });

        it("should redirect to external docs in production when enabled", () => {
            const configService = ConfigService as any;
            configService.isProduction.mockReturnValue(true);
            configService.isDevelopment.mockReturnValue(false);
            configService.isSwaggerEnabled.mockReturnValue(false);
            process.env.ENABLE_SWAGGER = "false";
            process.env.EXTERNAL_DOCS_URL = "https://docs.example.com";

            const mockApp = {
                use: vi.fn(),
                get: vi.fn(),
            } as any;

            SwaggerDocs.init(mockApp);

            // Verify isSwaggerEnabled was called
            expect(configService.isSwaggerEnabled).toHaveBeenCalled();

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