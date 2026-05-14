# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm dev               # Start with hot reload (tsx --watch)
pnpm build             # Compile TypeScript → dist/
pnpm start             # Run compiled dist/index.js
pnpm lint              # Type-check only (tsc --noEmit)

# Testing
pnpm test              # Run all tests (vitest, sequential)
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report (thresholds: 65% statements/functions/lines, 55% branches)

# Run a single test file
pnpm exec vitest run src/__tests__/unit/config/config.service.test.ts

# Database migrations
pnpm migrate:up        # Run pending migrations
pnpm migrate:down      # Rollback last batch
pnpm migrate:status    # Show migration status
pnpm migrate:create    # Create a new migration file

# Database management
pnpm db:reset          # Drop all tables, run migrations, seed
pnpm db:seed           # Seed with test data
pnpm db:drop           # Drop all tables
```

## Architecture

### Composition root

`src/index.ts` is the composition root. All objects are wired explicitly there — nothing reaches for `getInstance()` chains mid-graph. `ConfigService.getDatabaseConfig()` → `DatabaseInitializer` → `buildDatabaseContainer()` → `ExpressApp`.

### Database layer

The multi-database architecture centers on three classes:

- **`DbRegistry`** (`src/database/core/DbRegistry.ts`) — holds the model→database routing table. Hard-coded: `User`, `Otp`, `Token` → SQL (whichever `SQL_DB` env var selects); `Post`, `Comment`, `Like` → MongoDB. Supports `DB_MODE=single` to override all models to one DB.

- **`DbResolver`** (`src/database/core/DbResolver.ts`) — owns live adapter instances (`Map<DbType, IDatabaseAdapter>`). Constructed with `IDatabaseConfig`; instantiates `MongooseAdapter` or `KnexAdapter` for each configured DB. Exposes `getAdapterForModel(name)` which delegates to `DbRegistry`.

- **`RepositoryFactory`** (`src/factories/RepositoryFactory.ts`) — caches repository instances. `getRepository('Post')` returns a `PostRepository` wired to the correct adapter. `BaseRepository` covers CRUD; domain repositories add model-specific queries.

### Request → data flow

`DatabaseInitializer.initialize()` calls `buildDatabaseContainer()`, which sets up `DbRegistry`, `DbResolver`, and `RepositoryFactory`. The Express app mounts a middleware that attaches `req.repoFactory` for use in route handlers. No global repository singletons — all repos flow through `req.repoFactory`.

### Model schemas

`src/models/schemas/index.ts` exports `ModelSchemas`, a unified registry. Each entry carries either a `sql` key (table name + Knex migration function) or a `mongo` key (Mongoose schema definition). `DbResolver.registerModels()` routes each entry to the correct adapter.

### Config

`ConfigService` (`src/config/config.service.ts`) is a singleton that reads all env vars at startup. `SQL_DB` env var selects the active SQL database (`mysql` | `postgres` | `sqlite`; defaults to `mysql`). In production, `JWT_SECRET` and `API_BASE_URL` are required; `JWT_SECRET` must be ≥ 32 chars.

### Observability

`src/instrumentation.ts` starts an OpenTelemetry SDK at process boot (imported before anything else in `src/index.ts`). Prometheus metrics are exposed on port `9464` at `/metrics` by default. In dev, HTTP instrumentation is disabled to reduce overhead; set `OTEL_ENABLE_TRACES=true` to enable full tracing.

## Testing conventions

Tests live in `src/__tests__/unit/` and `src/__tests__/integration/`. Vitest runs all tests sequentially (`sequence.concurrent: false`) to avoid env-variable races between tests. Integration tests mock Express middleware and the DB layer rather than hitting real databases; use `supertest` for HTTP assertions. The `.env.test` file defaults to SQLite (`SQL_DB=sqlite`, `SQLITE_FILENAME=./data/test.sqlite`).

## Key env vars

| Variable | Purpose |
|---|---|
| `SQL_DB` | Active SQL DB: `mysql` \| `postgres` \| `sqlite` (default: `mysql`) |
| `DB_MODE` | `split` (default) routes models by type; `single` routes all models to `DEFAULT_DB` |
| `DEFAULT_DB` | Fallback DB for unmapped models (default: `mongodb`) |
| `AUTO_MIGRATE` | Set `true` to run migrations at startup in non-dev environments |
| `ENABLE_SWAGGER` | Swagger UI; auto-enabled in dev/staging, disabled in prod |
| `OTEL_ENABLE_TRACES` | Enable full OpenTelemetry tracing (dev is metrics-only by default) |
| `PROMETHEUS_METRICS_PORT` | Prometheus scrape port (default: `9464`) |
