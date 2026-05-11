# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
## [1.1.0] - 2026-05-11

### Added

#### Multi-database support
- `src/interfaces/core/database.ts` — new interface file containing all database contracts:
  `IDbConnectable`, `IDbHealthCheckable`, `IDbAdapter`, `IDbRegistry`, `IDbResolver`,
  `IDbManager`, `IDbConnectionConfig`, `IModelDbBinding`, `DbDriver`, `DbConnectionName`
- `src/config/db/adapters/MongooseAdapter.ts` — MongoDB/Mongoose adapter implementing `IDbAdapter`;
  handles connect, disconnect, ping via `connection.readyState`, and exposes the raw `mongoose.Connection`
- `src/config/db/adapters/KnexAdapter.ts` — relational adapter (PostgreSQL, MySQL, SQLite) implementing
  `IDbAdapter`; migrates dialect helpers (`isPostgres`, `isMySQL`, `isSQLite`, `compatibleILIKE`) 
- `src/config/db/AdapterFactory.ts` — factory mapping `DbDriver` to the correct adapter class; new
  drivers are added here only (OCP)
- `src/config/db/DbRegistry.ts` — manages a named map of adapters; provides `register`, `get`,
  `getDefault`, `setDefault`, `connectAll`, `disconnectAll`, `healthCheck`, `list`
- `src/config/db/DbResolver.ts` — routes model class names to their assigned connection; falls back to
  the default adapter for unbound models
- `src/config/db/DbManager.ts` — singleton façade owning the registry and resolver; the single import
  point for the rest of the application; exposes `initialize`, `shutdown`, `healthCheck`,
  `bindModel`, `resolveForModel`
- `src/config/db/DbConfig.ts` — reads env vars and builds `IDbConnectionConfig[]`; supports
  `MONGO_URI`, `PG_*`, `MYSQL_*`, `SQLITE_*`, and `DEFAULT_DB`
- `src/config/db/index.ts` — barrel export for the entire db module

#### Test coverage (160 tests across 8 files)
- `src/config/db/adapters/MongooseAdapter.test.ts` — 20 tests covering full adapter lifecycle,
  timeout defaults, missing URI, non-Error rejections, readyState ping variants
- `src/config/db/adapters/KnexAdapter.test.ts` — 27 tests covering lifecycle, pool defaults, SQLite
  `useNullAsDefault`, non-Error rejection handling, all 5 dialect helpers
- `src/config/db/AdapterFactory.test.ts` — 7 tests covering all 9 drivers, config pass-through,
  unsupported driver error message
- `src/config/db/DbRegistry.test.ts` — 20 tests covering register/get/default/list/connectAll
  (partial failure resilience)/disconnectAll/healthCheck
- `src/config/db/DbResolver.test.ts` — 11 tests covering bind, overwrite, fallback-to-default,
  bad-binding propagation
- `src/config/db/DbConfig.test.ts` — 32 tests covering all 4 driver builders, name overrides,
  `DEFAULT_DB` routing, `DB_HOST`/`DB_NAME` fallbacks, pool/SSL/timeout values, multi-connection
- `src/config/db/DbManager.test.ts` — 19 tests covering singleton lifecycle, initialize edge cases
  (empty/multi-default/auto-default/idempotent/factory-throws), shutdown, healthCheck, model binding
- `src/app/index.test.ts` — extended with 5 new tests: `/health` includes `databases` field,
  graceful degradation when `healthCheck` throws, `/api/db/status` endpoint (connections, health,
  model bindings)

### Changed
- `src/app/index.ts` — `_init()` now calls `_initDatabases()` before binding the HTTP port;
  `_close()` calls `DbManager.shutdown()` on graceful shutdown; `/health` response includes a
  `databases` map from `DbManager.healthCheck()`; adds `/api/db/status` route (non-production only)
  showing connections, health, and model bindings
- `src/interfaces/core/config.ts` — DB-specific fields removed (moved to `database.ts`); `DEFAULT_DB`
  optional field added to `IEnvConfig`
- `.env.example` — updated with full `MONGO_*`, `PG_*`, `MYSQL_*`, `SQLITE_*`, and `DEFAULT_DB`
  documentation


## [Unreleased]

### Added
- `src/middlewares/Http.ts` — helmet, compression, express json/urlencoded body parsing
- `src/middlewares/Morgan.ts` — HTTP request logging routed through Winston at the `http` level
- `src/middlewares/CORS.ts` — singleton CORS instance with credentials, exposed `x-auth-token`, wildcard origin
- `src/exceptions/ApiError.ts` — custom error class carrying `statusCode` alongside `message`
- `src/exceptions/Handler.ts` — four static error handlers: `logErrors`, `clientErrorHandler`, `errorHandler`, `notFoundHandler`
- `src/interfaces/core/express.ts` — typed `IRequest`, `IResponse`, `INext` with optional `currentUser`
- `src/interfaces/core/config.ts` — merged interface: strict `Environment` type, all required fields, optional future fields (Mongo, JWT, CORS, email, Cloudinary, Firebase)
- `src/constants/statusCodes.ts` — typed HTTP status code constants
- `src/constants/strings.ts` — shared error string constants
- `src/entities/user.ts` — `IUserModel` interface stub
- `CORS_ENABLED` promoted to required field in `IEnvConfig` with opt-out default (`!== "false"`)
- Unit tests for all new modules: `Http.test.ts`, `Morgan.test.ts`, `CORS.test.ts`, `ApiError.test.ts`, `Handler.test.ts`
- `CORS_ENABLED` env var tests covering: unset (default true), explicit true/false, non-false value

### Changed
- `src/app/index.ts` — refactored from static singleton to instance-based class; `public express` is now directly accessible; `_init()` separated from construction so tests import the app without binding a port; `_close()` returns `Promise<void>` and no longer calls `process.exit()` directly
- `src/app/index.ts` — error handler registration order fixed: `logErrors → clientErrorHandler → errorHandler → notFoundHandler` (wildcard catch-all must be last)
- `src/app/index.ts` — CORS mounting is now gated on `EnvConfig.getConfig().CORS_ENABLED`
- `src/config/env.ts` — `CORS_ENABLED` populated in `loadConfig()` with opt-out default
- `src/app/index.test.ts` — rewritten for instance API; all mocks include correct return shapes
- `src/__tests__/integration/api.integration.test.ts` — updated for instance API; `EnvConfig.init` and `SwaggerDocs.init` mocks now return the app to prevent `this.express` being overwritten with `undefined`
- `package.json` — added `helmet`, `compression`, `morgan`, `cors` and their `@types`

### Fixed
- `Http.ts` — removed duplicate `body-parser` registration that caused "stream is not readable" double-parse error under Express 5
- `Handler.ts` — wildcard route changed from `"*"` to `"/{*path}"` for Express 5 compatibility
- `Morgan.ts` — added `as any` cast for Winston custom `http` level which is absent from the static type
- `app/index.ts` — `notFoundHandler` was registered before error middleware, causing thrown errors to resolve as 404s instead of reaching the error chain


