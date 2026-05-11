# X-Socials API

[![codecov](https://codecov.io/gh/codedsultan/x-socials/branch/main/graph/badge.svg)](https://codecov.io/gh/codedsultan/x-socials/branch/main/graph/badge.svg)
[![Node.js Version](https://img.shields.io/badge/node-18%2B-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-8.0-orange)](https://pnpm.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A robust Node.js TypeScript application with Express, featuring environment-based configuration, comprehensive logging, Swagger documentation, and CI/CD pipelines.

---

## Features

- **TypeScript** — Type-safe code with full TypeScript support
- **Express.js** — Fast, unopinionated web framework
- **Environment Configuration** — Development, Staging, and Production environments
- **Swagger/OpenAPI** — Automatic API documentation
- **Winston Logger** — Structured logging with environment-based formatting
- **Multi-Database** — Simultaneous MongoDB, PostgreSQL, MySQL, and SQLite connections with per-model routing
- **Vitest** — Fast unit and integration testing
- **pnpm** — Fast, disk-efficient package manager
- **CI/CD Ready** — GitHub Actions workflows for automated testing and deployment

---

## Prerequisites

- Node.js v22 or higher
- pnpm v8 or higher (`npm install -g pnpm`)

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/codedsultan/x-social
cd x-social-api

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start development server
pnpm dev
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Compile TypeScript to JavaScript |
| `pnpm start` | Start production server |
| `pnpm test` | Run tests in watch mode |
| `pnpm test:run` | Run tests once |
| `pnpm test:coverage` | Run tests with coverage report |
| `npx tsc --noEmit` | Check TypeScript types without compiling |

---

## Environment Configuration

The application supports multiple environments:

| Environment | Features | Use Case |
|-------------|----------|----------|
| **Development** | Full logging, Swagger enabled, detailed errors | Local development |
| **Staging** | Moderate logging, Swagger enabled, limited error details | Pre-production testing |
| **Production** | Minimal logging, Swagger disabled, safe error messages | Live production |

### Environment Variables

```env
# Required
PORT=5000                    # Server port
NODE_ENV=development         # Environment: development | staging | production | test

# Optional
SERVER_MAINTENANCE=false     # Enable maintenance mode
ENABLE_SWAGGER=true          # Force-enable Swagger (useful in staging)
API_BASE_URL=                # Base URL for the API

# ── Database (at least one required) ──────────────────────────────────────────
DEFAULT_DB=mongodb           # Which named connection is the default

# MongoDB
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=x_socials
# MONGO_CONNECTION_NAME=mongodb        # logical name (default: "mongodb")
# MONGO_SOCKET_TIMEOUT_MS=30000
# MONGO_SERVER_SELECTION_TIMEOUT_MS=5000

# PostgreSQL
# PG_HOST=localhost
# PG_PORT=5432
# PG_DATABASE=x_socials
# PG_USER=postgres
# PG_PASSWORD=secret
# PG_SSL=false
# PG_CLIENT=pg                         # pg | pg-native
# PG_CONNECTION_NAME=postgres
# PG_POOL_MIN=2
# PG_POOL_MAX=10

# MySQL
# MYSQL_HOST=localhost
# MYSQL_PORT=3306
# MYSQL_DATABASE=x_socials
# MYSQL_USER=root
# MYSQL_PASSWORD=secret
# MYSQL_CLIENT=mysql2                  # mysql | mysql2
# MYSQL_CONNECTION_NAME=mysql

# SQLite
# SQLITE_FILENAME=./data/x_socials.sqlite
# SQLITE_CLIENT=better-sqlite3         # sqlite3 | better-sqlite3
# SQLITE_CONNECTION_NAME=sqlite
```

See `.env.example` for a full reference.

---

## Project Structure

```
social-media-api/
├── src/
│   ├── app/
│   │   └── index.ts            # Express app configuration
│   ├── config/
│   │   ├── db/
│   │   │   ├── adapters/
│   │   │   │   ├── MongooseAdapter.ts  # MongoDB/Mongoose adapter
│   │   │   │   └── KnexAdapter.ts      # PostgreSQL / MySQL / SQLite adapter
│   │   │   ├── AdapterFactory.ts       # Maps DbDriver → adapter class
│   │   │   ├── DbRegistry.ts           # Named adapter map + lifecycle
│   │   │   ├── DbResolver.ts           # Per-model connection routing
│   │   │   ├── DbManager.ts            # Singleton façade (main entry point)
│   │   │   ├── DbConfig.ts             # Reads DB env vars
│   │   │   └── index.ts                # Barrel export
│   │   ├── env.ts              # Environment configuration
│   │   └── swagger.ts          # Swagger/OpenAPI setup
│   ├── interfaces/
│   │   └── core/
│   │       ├── config.ts       # App-level TypeScript interfaces
│   │       └── database.ts     # Database contracts (IDbAdapter, IDbRegistry, …)
│   ├── logger/
│   │   └── index.ts            # Winston logger setup
│   └── index.ts                # Application entry point
├── src/__tests__/
│   ├── unit/                   # Unit tests
│   └── integration/            # Integration tests
├── .github/
│   └── workflows/
│       ├── ci.yml              # Continuous Integration
│       └── cd.yml              # Continuous Deployment
├── .env.example                # Example environment variables
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---
## Architecture

### Application bootstrap — `src/app/index.ts`

`ExpressApp` is an instance-based class exported as a singleton (`export default new ExpressApp()`). Construction wires all middleware, routes, and handlers in order. Listening is deferred to `_init()` so the app can be imported and tested without binding a port.

```
constructor()
  ├── _mountLogger()         Logger._init(), confirms Winston is ready
  ├── _mountMiddlewares()    Http → Morgan → CORS (if enabled) → headers → maintenance gate
  ├── _mountMonitoring()     Prometheus metrics middleware
  ├── _mountConfigs()        EnvConfig.init, SwaggerDocs.init
  ├── _mountRoutes()         Health probes, root, API routes
  └── _registerHandlers()    logErrors → clientErrorHandler → errorHandler → notFoundHandler
```

**Handler order is load-bearing.** `notFoundHandler` registers a wildcard catch-all and must be last. Placing it before the error middleware causes thrown errors to resolve as 404s.

### Middleware — `src/middlewares/`

| File | Responsibility |
|---|---|
| `Http.ts` | helmet (security headers), compression, express json/urlencoded |
| `Morgan.ts` | HTTP access logging routed through Winston at the `http` level |
| `CORS.ts` | Cross-origin policy — singleton instance, credentials enabled, `x-auth-token` exposed |

CORS is gated: set `CORS_ENABLED=false` to disable. It defaults to enabled.

### Exception handling — `src/exceptions/`

| File | Responsibility |
|---|---|
| `ApiError.ts` | Extends `Error` with a `statusCode` field |
| `Handler.ts` | Four static Express error handlers covering logging, XHR clients, named JWT/Mongoose errors, and 404 catch-all |

### Environment config — `src/config/env.ts`

All config is loaded once and cached. Required fields are validated at startup — the process refuses to start with a missing or malformed `PORT` or `NODE_ENV`.

Key env vars:

| Var | Default | Notes |
|---|---|---|
| `PORT` | `4000` | 0 = OS-assigned |
| `NODE_ENV` | `development` | `development` / `staging` / `production` / `test` |
| `CORS_ENABLED` | `true` | Set to `false` to opt out |
| `SERVER_MAINTENANCE` | `false` | Non-health routes return 503 when true |
| `ENABLE_SWAGGER` | `false` in prod | Auto-enabled in dev/staging |

### Interfaces — `src/interfaces/core/`

- `config.ts` — `IEnvConfig` (required fields) + `DEFAULT_DB` + optional fields (JWT, email, Cloudinary) + `IFirebaseConfig`
- `express.ts` — `IRequest` / `IResponse` / `INext` with typed `currentUser?: IUserModel`
- `database.ts` — All database contracts. Key interfaces:

| Interface | Responsibility |
|---|---|
| `IDbAdapter` | Single connection — connect, disconnect, ping, getClient |
| `IDbRegistry` | Named adapter map — register, get, getDefault, connectAll, healthCheck |
| `IDbResolver` | Model → connection routing with default fallback |
| `IDbManager` | Façade — initialize, shutdown, bindModel, resolveForModel |
| `IDbConnectionConfig` | Per-connection config shape (driver, host, pool, ssl, …) |
| `IModelDbBinding` | Associates a model class name with a connection name |

### Database — `src/config/db/`

The multi-DB system is built around four SOLID-aligned layers:

```
DbConfig.buildAll()          reads env vars → IDbConnectionConfig[]
       ↓
AdapterFactory.create()      IDbConnectionConfig → IDbAdapter
       ↓
DbRegistry                   holds named adapters, drives connectAll / healthCheck
       ↓
DbResolver                   routes model names → adapters (falls back to default)
       ↓
DbManager (singleton)        façade owned by app/index.ts
```

**Registering connections** happens automatically in `app/_init()` via `DbConfig.buildAll()`. Every `DB_*` / `MONGO_URI` / `PG_*` / `MYSQL_*` / `SQLITE_*` env var that is present produces a named connection.

**Binding a model to a specific connection** (optional — unbound models use the default):

```ts
import DbManager from "./config/db/DbManager";

DbManager.getInstance().bindModel({
  modelName: "AnalyticsModel",
  connectionName: "postgres",      // must match PG_CONNECTION_NAME or "postgres"
});
```

**Accessing the raw client in a repository:**

```ts
import DbManager from "./config/db/DbManager";
import type { KnexAdapter } from "./config/db/adapters/KnexAdapter";
import type { MongooseAdapter } from "./config/db/adapters/MongooseAdapter";

// By model name (uses binding or default)
const adapter = DbManager.getInstance().resolveForModel("UserModel");
const mongoose = (adapter as MongooseAdapter).getClient(); // mongoose.Connection

// By connection name directly
const pg = DbManager.getInstance().registry.get("postgres") as KnexAdapter;
const knex = pg.getClient(); // Knex instance
```

**Adding a new driver** requires only one new `case` in `AdapterFactory.ts` and a new adapter class — no other files change.

## API Endpoints

**Base URL:** `http://localhost:5000`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Welcome message with environment info |
| GET | `/health` | Server health + per-connection DB ping |
| GET | `/ready` | Kubernetes readiness probe |
| GET | `/live` | Kubernetes liveness probe |
| GET | `/api/environment` | Current environment configuration |
| GET | `/api/users` | List of users (TODO) |
| GET | `/api/db/status` | Connection names, health map, model bindings *(non-production only)* |
| GET | `/api-docs` | Swagger UI (dev/staging only) |
| GET | `/api-docs.json` | Swagger JSON specification |

### Example responses

**`GET /`**
```json
{
  "message": "🚀 Development Server - Social Media API",
  "environment": "development",
  "version": "1.0.0",
  "documentation": "/api-docs",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**`GET /health`**
```json
{
  "status": "OK",
  "environment": "development",
  "maintenance": false,
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "databases": {
    "mongodb": true,
    "postgres": true
  }
}
```

**`GET /api/db/status`** *(non-production only)*
```json
{
  "connections": ["mongodb", "postgres"],
  "health": { "mongodb": true, "postgres": true },
  "modelBindings": [
    { "modelName": "UserModel", "connectionName": "mongodb" },
    { "modelName": "AnalyticsModel", "connectionName": "postgres" }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Testing

```bash
# Run all tests (watch mode)
pnpm test

# Run once (for CI)
pnpm test:run

# With coverage report
pnpm test:coverage
```

Tests are organised into unit tests (isolated components) and integration tests (API endpoints and module interactions).

---

## Deployment

### Development
```bash
pnpm dev
```

### Staging
```bash
pnpm build
pnpm start:staging
```

### Production
```bash
pnpm build
NODE_ENV=production pnpm start
```

---

## CI/CD Pipeline

### Continuous Integration
Runs on every push and pull request to `main` and `develop`:
- Installs dependencies via pnpm with cache
- Runs TypeScript type checking
- Executes test suite with coverage upload to Codecov
- Builds the application and uploads artifacts
- Runs a security audit and optional Snyk scan

### Continuous Deployment
Triggers on push to `main`:
1. **Staging** — Deploys automatically after CI passes
2. **Production** — Deploys after staging succeeds (requires `production` environment approval in GitHub)

---

## Logging

Winston provides structured logging:

| Level | Value | Used for |
|-------|-------|----------|
| `error` | 0 | Critical failures |
| `warn` | 1 | Warning messages |
| `info` | 2 | General information |
| `http` | 3 | HTTP request logs |
| `debug` | 4 | Debug info (dev only) |

Development logs are colorised with timestamps. Production logs output plain JSON.

---

## Error Handling

- **404 handler** — Returns JSON for unmatched routes
- **Global error handler** — Catches and formats all errors
- **Environment-aware** — Stack traces only exposed in non-production environments

---

## Docker Support 


---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT License — see the [LICENSE](LICENSE) file for details.

---

## Author

**Olusegun Ibraheem**
- Website: [codesultan.xurl.fyi](https://codesultan.xurl.fyi)
- Email: codesultan369@gmail.com
