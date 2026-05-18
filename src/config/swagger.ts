import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Application } from "express";
import Logger from "../logger";
import ConfigService from "./config.service";
import { components, paths } from "../swagger/docs";

class SwaggerDocs {
    private static swaggerSpecs: object | null = null;

    private static getOptions() {
        const configService = ConfigService;
        const isProduction = configService.isProduction();
        const serverUrl = configService.getApiUrl();
        const nodeEnv = configService.getNodeEnv();

        // Different server configurations per environment
        const servers = [
            {
                url: serverUrl,
                description: `${nodeEnv.toUpperCase()} server`,
            },
        ];

        // Add localhost for development and staging (but not production)
        if (!isProduction) {
            servers.unshift({
                url: `http://localhost:${configService.getPort()}`,
                description: "Local development server",
            });
        }

        return {
            definition: {
                openapi: "3.0.0",
                info: {
                    title: "x-socials API",
                    version: "1.0.0",
                    description: [
                        '## x-socials — Social Media Platform API',
                        '',
                        '### Authentication',
                        'All protected endpoints require a `Bearer <accessToken>` header.',
                        'Obtain tokens from `POST /auth/login` or `POST /auth/register`.',
                        '',
                        '### Response envelope',
                        'Every response uses a consistent shape:',
                        '```json',
                        '{ "success": true, "data": { ... }, "message": "optional" }',
                        '{ "success": false, "error": "human-readable message" }',
                        '```',
                        '',
                        '### Pagination',
                        '| Strategy | Used by | Query params |',
                        '|---|---|---|',
                        '| Offset | Users list, post search | `?page=1&limit=20` |',
                        '| Cursor | Feed, post timeline | `?cursor=<token>&limit=20` |',
                        '| Keyset | Comments, followers | `?after=<id>&limit=20` |',
                        '',
                        '### Seed credentials',
                        'Password for all seed users: **SeedPass123**',
                        '- alice@example.com (followed by everyone)',
                        '- bob@example.com · charlie@example.com · diana@example.com',
                    ].join('\n'),
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
                components,
                paths,
                tags: [
                    { name: 'Auth', description: 'Registration, login, token rotation' },
                    { name: 'Users', description: 'Profiles, follow / unfollow, follower lists' },
                    { name: 'Posts', description: 'Create, read, update, delete posts' },
                    { name: 'Comments', description: 'Threaded comments and replies' },
                    { name: 'Likes', description: 'Toggle likes on posts and comments' },
                    { name: 'Feed', description: 'Personalised home feed and per-user timelines' },
                ],
            },
            apis: [], // No need for JSDoc paths since we're using the object format
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
        const configService = ConfigService;
        const nodeEnv = configService.getNodeEnv();

        const enableSwagger = configService.isSwaggerEnabled();

        if (enableSwagger) {
            const swaggerSpecs = this.getSwaggerSpecs();

            // Serve swagger UI
            _express.use(
                "/api-docs",
                swaggerUi.serve,
                swaggerUi.setup(swaggerSpecs, {
                    explorer: true,
                    customCss: '.swagger-ui .topbar { display: none }',
                    customSiteTitle: `x-socials API — ${nodeEnv.toUpperCase()}`,
                    swaggerOptions: {
                        persistAuthorization: true,
                        displayRequestDuration: true,
                        filter: true,
                        tryItOutEnabled: configService.isDevelopment(),
                    },
                })
            );

            // Serve swagger.json endpoint
            _express.get("/api-docs.json", (_req, res) => {
                res.setHeader("Content-Type", "application/json");
                res.send(swaggerSpecs);
            });

            if (configService.isStaging()) {
                Logger.getInstance().warn("Swagger :: Running in STAGING mode with documentation enabled");
            } else if (configService.isProduction()) {
                Logger.getInstance().warn("Swagger :: Running in PRODUCTION mode with documentation enabled (override)");
            } else {
                Logger.getInstance().info(`Swagger :: Initialized at /api-docs (${nodeEnv} mode)`);
            }
        } else {
            if (configService.isProduction()) {
                Logger.getInstance().info("Swagger :: Disabled in production");
            } else {
                Logger.getInstance().info(`Swagger :: Disabled via environment configuration (${nodeEnv} mode)`);
            }

            if (process.env.EXTERNAL_DOCS_URL) {
                _express.get("/api-docs", (_req, res) => {
                    res.redirect(process.env.EXTERNAL_DOCS_URL as string);
                });
                _express.get("/api-docs.json", (_req, res) => {
                    res.redirect(`${process.env.EXTERNAL_DOCS_URL}/json`);
                });
            } else {
                _express.get("/api-docs", (_req, res) => {
                    res.status(404).json({
                        error: "Swagger documentation is disabled",
                        environment: nodeEnv
                    });
                });
                _express.get("/api-docs.json", (_req, res) => {
                    res.status(404).json({
                        error: "Swagger documentation is disabled",
                        environment: nodeEnv
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