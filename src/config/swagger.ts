import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Application } from "express";
import Logger from "../logger";
import EnvConfig from "./env";

class SwaggerDocs {
    private static swaggerSpecs: object | null = null;

    private static getOptions() {
        const config = EnvConfig.getConfig();
        const isProduction = EnvConfig.isProduction();
        const isStaging = EnvConfig.isStaging();
        const serverUrl = EnvConfig.getApiUrl();

        // Different server configurations per environment
        const servers = [
            {
                url: serverUrl,
                description: `${config.NODE_ENV.toUpperCase()} server`,
            },
        ];

        // Add localhost for development and staging (but not production)
        if (!isProduction) {
            servers.unshift({
                url: `http://localhost:${config.PORT}`,
                description: "Local development server",
            });
        }

        return {
            definition: {
                openapi: "3.0.0",
                info: {
                    title: "Social Media API",
                    version: "1.0.0",
                    description: `API documentation for the Social Media application${isStaging ? " (STAGING ENVIRONMENT)" : ""
                        }`,
                    license: {
                        name: "MIT",
                        url: "https://spdx.org/licenses/MIT.html",
                    },
                    contact: {
                        name: "Olusegun Ibraheem",
                        url: "https://codesultan.xurl.fyi",
                        email: "codesultan369@gmail.com",
                    },
                },
                servers,
                components: {
                    securitySchemes: {
                        bearerAuth: {
                            type: "http",
                            scheme: "bearer",
                            bearerFormat: "JWT",
                        },
                    },
                },
                tags: [
                    {
                        name: "Health",
                        description: "Health check endpoints",
                    },
                    {
                        name: "Users",
                        description: "User management endpoints",
                    },
                ],
            },
            apis: isProduction
                ? [
                    "./dist/routes/*.js",
                    "./dist/models/*.js",
                    "./dist/controllers/**/*.js",
                ]
                : [
                    "./src/routes/*.ts",
                    "./src/models/*.ts",
                    "./src/controllers/**/*.ts",
                ],
        };
    }

    private static getSwaggerSpecs() {
        if (!this.swaggerSpecs) {
            this.swaggerSpecs = swaggerJsdoc(this.getOptions());
        }
        return this.swaggerSpecs;
    }

    /**
     * Initialize Swagger Docs
     */
    public static init(_express: Application): Application {
        const config = EnvConfig.getConfig();

        const enableSwagger = EnvConfig.isSwaggerEnabled();

        if (enableSwagger) {
            const swaggerSpecs = this.getSwaggerSpecs();

            // Serve swagger UI
            _express.use(
                "/api-docs",
                swaggerUi.serve,
                swaggerUi.setup(swaggerSpecs, {
                    explorer: true,
                    customCss: '.swagger-ui .topbar { display: none }',
                    customSiteTitle: `Social Media API - ${config.NODE_ENV.toUpperCase()}`,
                    swaggerOptions: {
                        persistAuthorization: true,
                        displayRequestDuration: true,
                        filter: true,
                        tryItOutEnabled: EnvConfig.isDevelopment(), // Enable try-it-out only in development
                    },
                })
            );

            // Serve swagger.json endpoint
            _express.get("/api-docs.json", (_req, res) => {
                res.setHeader("Content-Type", "application/json");
                res.send(swaggerSpecs);
            });

            // Add environment badge to swagger UI
            if (EnvConfig.isStaging()) {
                Logger.getInstance().warn("Swagger :: Running in STAGING mode with documentation enabled");
            } else if (EnvConfig.isProduction()) {
                Logger.getInstance().warn("Swagger :: Running in PRODUCTION mode with documentation enabled (override)");
            } else {
                Logger.getInstance().info(`Swagger :: Initialized at /api-docs (${config.NODE_ENV} mode)`);
            }
        } else {
            if (EnvConfig.isProduction()) {
                Logger.getInstance().info("Swagger :: Disabled in production");
            } else {
                Logger.getInstance().info(`Swagger :: Disabled via environment configuration (${config.NODE_ENV} mode)`);
            }

            // Optionally redirect to external docs 
            if (process.env.EXTERNAL_DOCS_URL) {
                _express.get("/api-docs", (_req, res) => {
                    res.redirect(process.env.EXTERNAL_DOCS_URL as string);
                });
                _express.get("/api-docs.json", (_req, res) => {
                    res.redirect(`${process.env.EXTERNAL_DOCS_URL}/json`);
                });
            } else {
                // Return 404 when swagger is disabled
                _express.get("/api-docs", (_req, res) => {
                    res.status(404).json({
                        error: "Swagger documentation is disabled",
                        environment: config.NODE_ENV
                    });
                });
                _express.get("/api-docs.json", (_req, res) => {
                    res.status(404).json({
                        error: "Swagger documentation is disabled",
                        environment: config.NODE_ENV
                    });
                });
            }
        }

        return _express;
    }

    /**
     * Get swagger specifications as JSON
     */
    public static getSpecs(): object {
        return this.getSwaggerSpecs();
    }
}

export default SwaggerDocs;