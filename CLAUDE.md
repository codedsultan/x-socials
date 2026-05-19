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
pnpm exec vitest run src/modules/auth/__tests__/auth.service.test.ts

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

### Module structure

Each feature lives in `src/modules/<name>/` and owns exactly five files:

```
src/modules/<name>/
  <name>.routes.ts      # Express Router: wires middleware + controller
  <name>.controller.ts  # Thin handler: parse req → call service → send response
  <name>.service.ts     # All business logic; receives repoFactory, never touches req/res
  <name>.validator.ts   # Zod schemas exported as ready-to-use middleware
  <name>.types.ts       # DTOs and response shapes for this module
  __tests__/            # Unit tests co-located with the module
```

**No logic in controllers or routes.** Controllers do one thing: call a service method and pass the result to a response helper. Services receive `repoFactory` (and scalar IDs) as arguments — they never read from `req` directly. This makes services trivially testable without HTTP overhead.

### Current modules

| Module    | Routes prefix        | Key endpoints |
|-----------|----------------------|---------------|
| `auth`    | `/api/auth`          | POST register, login, refresh, logout; GET me |
| `users`   | `/api/users`         | GET list, GET/PATCH me, GET :id |
| `posts`   | `/api/posts`         | GET list (tag/author filter), GET/POST/PATCH/DELETE :id |
| `comments`| `/api` (nested)      | GET/POST /posts/:postId/comments; GET replies, PATCH/DELETE /comments/:id |
| `likes`   | `/api/likes`         | POST toggle, GET count |
| `feed`    | `/api/feed`          | GET home feed, GET /users/:userId |

### Shared infrastructure (`src/shared/`)

Import from `../../shared`:

```ts
import { authenticate, validate, sendSuccess, ApiError, apiLimiter } from '../../shared';
```

| Export | Description |
|--------|-------------|
| `authenticate` | JWT middleware — attaches `req.currentUser = { id, email }` |
| `optionalAuthenticate` | Same but does not reject requests without a token |
| `validate(schema, target?)` | Zod middleware factory; target defaults to `'body'` |
| `authLimiter` | 10 req / 15 min — use on login/register |
| `apiLimiter` | 100 req / min — use as router-level default |
| `writeLimiter` | 30 req / min — use on mutation endpoints |
| `sendSuccess(res, data, opts?)` | 200 `{ success: true, data, message?, meta? }` |
| `sendCreated(res, data, msg?)` | 201 equivalent |
| `sendNoContent(res)` | 204 with no body |
| `ApiError.badRequest(msg)` | 400 |
| `ApiError.unauthorized(msg)` | 401 |
| `ApiError.forbidden(msg)` | 403 |
| `ApiError.notFound(msg)` | 404 |
| `ApiError.conflict(msg)` | 409 |

### Adding a new module

1. Create `src/modules/<name>/` with the five standard files.
2. Register the router in `src/router/ModuleRouter.ts`.
3. Write service unit tests in `src/modules/<name>/__tests__/`.
4. No changes needed to `ExpressApp`.

### Composition root

`src/index.ts` → `DatabaseInitializer` → `ExpressApp` → `ModuleRouter.mount()`.

### Database layer

- **`DbRegistry`** — model→database routing. `User`, `Otp`, `Token` → SQL; `Post`, `Comment`, `Like` → MongoDB.
- **`DbResolver`** — owns live adapter instances.
- **`RepositoryFactory`** — caches repository instances. `getRepository('Post')` returns a `PostRepository`.

### Request → data flow

```
Request
  → Global middleware (CORS, Helmet, Morgan, body-parser)
  → repoFactory middleware
  → Module router
      → Rate limiter
      → authenticate / optionalAuthenticate
      → validate(schema)
      → Controller → Service → Repository
      → sendSuccess / sendCreated / sendNoContent
  → ExceptionHandler
```

### Config

`ConfigService` reads all env vars at startup. `JWT_SECRET` must be ≥ 32 chars in production.

### Observability

OpenTelemetry at process boot. Prometheus on port `9464` at `/metrics`. Probes: `/health`, `/ready`, `/live`.

## Testing conventions

- `src/__tests__/` — infra unit tests (config, database, repositories)
- `src/modules/<name>/__tests__/` — module service and validator tests
- `src/shared/__tests__/` — shared middleware and helper tests

**Service tests use fakes, never real adapters.** Pattern:

```ts
function makeFactory(overrides = {}) {
  const repo = { findById: vi.fn().mockResolvedValue(entity), ...overrides };
  return { getRepository: vi.fn(() => repo), _repo: repo };
}
```

**Config mocking:**
```ts
vi.mock('../../config/config.service', () => ({
  default: { getServerConfig: () => ({ JWT_SECRET: 'test-secret-32-chars-min!!!!!' }) },
}));
```

## Key env vars

| Variable | Purpose |
|---|---|
| `SQL_DB` | `mysql` \| `postgres` \| `sqlite` (default: `mysql`) |
| `DB_MODE` | `split` (default) or `single` |
| `JWT_SECRET` | ≥ 32 chars; required in production |
| `JWT_EXPIRES_IN` | Access token TTL (default: `7d`) |
| `AUTO_MIGRATE` | `true` to run migrations at startup in non-dev |
| `ENABLE_SWAGGER` | Auto-enabled in dev/staging |
| `PROMETHEUS_METRICS_PORT` | Default: `9464` |
