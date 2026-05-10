# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
