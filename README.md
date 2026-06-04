# X-Socials API

[![codecov](https://codecov.io/gh/codedsultan/x-socials/branch/main/graph/badge.svg)](https://codecov.io/gh/codedsultan/x-socials/branch/main/graph/badge.svg)
[![Node.js Version](https://img.shields.io/badge/node-20%2B-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.0-orange)](https://pnpm.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Node.js / TypeScript social platform API built with Express, featuring multi-database support (MongoDB + SQL), a full transactional email system with BullMQ queue, OTP-based auth flows, and comprehensive observability.

---

## Features

- **TypeScript** — strict mode throughout, `strict_types` on every file
- **Express.js** — modular router, single-action controllers, service-layer business logic
- **Multi-Database** — MongoDB for documents (posts, comments, likes) + configurable SQL (MySQL / PostgreSQL / SQLite) for users, tokens, OTPs
- **Auth** — JWT access tokens + refresh token rotation, email verification, password reset
- **Email** — provider-agnostic SMTP driver (Brevo-compatible), typed template system, BullMQ queue with retry
- **OTP** — crypto-safe 6-digit codes, 10-minute TTL, per-purpose invalidation
- **BullMQ Queue** — background email worker with exponential backoff; falls back to inline send in local dev
- **Rate Limiting** — per-route limiters (auth: 10/15 min, write: 30/min, api: 100/min)
- **Observability** — OpenTelemetry, Prometheus metrics on `:9464/metrics`, `/health`, `/ready`, `/live` probes
- **Swagger/OpenAPI** — auto-generated docs in dev/staging
- **Winston Logger** — structured, environment-aware logging
- **Migrations** — Knex CLI with rollback support
- **Testing** — Vitest, 390+ tests, coverage gates (65% statements/functions/lines, 55% branches)

---

## Prerequisites

- Node.js v20+
- pnpm v10+ (`npm install -g pnpm`)
- MongoDB
- One SQL database: MySQL, PostgreSQL, or SQLite
- Redis (required in staging/production for the email queue; optional locally)

---

## Quick Start

```bash
git clone https://github.com/codedsultan/x-socials
cd x-socials

pnpm install
cp .env.example .env
# Edit .env — minimum: JWT_SECRET, MONGO_URI, and your SQL vars

pnpm migrate:up
pnpm dev
```

The API starts on `http://localhost:4000`.

---

## Project Structure

```
src/
  app/                        # ExpressApp class — mounts middleware and routers
  config/                     # ConfigService singleton, Swagger setup
  database/
    adapters/                 # KnexAdapter (SQL), MongooseAdapter
    core/                     # DbRegistry, DbResolver, RepositoryFactory
    initializer.ts            # Database lifecycle manager
  modules/                    # Feature modules — one folder per domain
    auth/                     # register, login, refresh, logout, me,
    │                         # email verification, password reset
    users/
    posts/
    comments/
    likes/
    feed/
    notifications/
  repositories/               # Data access — BaseRepository + per-model
  services/
    email/
      drivers/                # IEmailDriver interface + SmtpDriver (nodemailer)
      templates/              # base.layout, otp-block partial, per-type templates
      EmailService.ts         # sendTemplate(type, to, data) facade
    otp/
      OtpService.ts           # issue(), verify() — crypto.randomInt, expiry enforcement
  queue/
    emailQueue.ts             # BullMQ Queue, enqueueEmail() typed helper
  workers/
    emailWorker.ts            # Standalone worker process
  shared/                     # Middleware, error helpers, response helpers
  logger/                     # Winston
  index.ts                    # Composition root
database/
  migrations/                 # Knex migration files
scripts/                      # db:reset, db:seed, migrate CLI
```

---

## Module Structure

Each feature lives in `src/modules/<name>/` with exactly five files:

```
<name>.routes.ts      # Express Router — wires rate limiters, auth, validate, controller
<name>.controller.ts  # Thin handler — parses req, calls service, sends response
<name>.service.ts     # All business logic — receives repoFactory and scalar IDs only
<name>.validator.ts   # Zod schemas exported as ready-to-use middleware
<name>.types.ts       # DTOs and response shapes
__tests__/            # Unit tests co-located with the module
```

No logic in controllers or routes. Services never touch `req`/`res`.

---

## API Endpoints

**Base URL:** `http://localhost:4000/api`

### Health & Status

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Welcome + environment info |
| GET | `/health` | Server health + DB status |
| GET | `/ready` | Readiness probe |
| GET | `/live` | Liveness probe |

### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | — | Create account; fires verification email |
| POST | `/login` | — | Returns access + refresh tokens |
| POST | `/refresh` | — | Rotate refresh token |
| POST | `/logout` | ✓ | Revoke all sessions |
| GET | `/me` | ✓ | Current user |
| POST | `/email/request` | ✓ | Resend email verification OTP |
| POST | `/email/verify` | ✓ | Submit OTP, marks `email_verified_at` |
| POST | `/password/forgot` | — | Request reset OTP (always 204 — prevents enumeration) |
| POST | `/password/reset` | — | Submit OTP + new password, revokes all sessions |

### Users (`/api/users`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | — | List users |
| GET | `/:id` | — | User profile |
| PATCH | `/me` | ✓ | Update own profile |
| POST | `/:id/follow` | ✓ | Follow |
| DELETE | `/:id/follow` | ✓ | Unfollow |

### Posts (`/api/posts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | — | List (filter by tag, author) |
| POST | `/` | ✓ | Create post |
| GET | `/:id` | — | Single post |
| PATCH | `/:id` | ✓ | Update post |
| DELETE | `/:id` | ✓ | Delete post |

### Comments, Likes, Feed, Notifications

| Prefix | Key endpoints |
|--------|---------------|
| `/api/posts/:postId/comments` | GET, POST; replies via `?parentId=` |
| `/api/comments/:id` | PATCH, DELETE |
| `/api/likes` | POST toggle (post or comment) |
| `/api/feed` | GET home feed (cursor pagination) |
| `/api/notifications` | GET list, PATCH `:id/read` |

---

## Email System

### Architecture

```
Auth flows (register, forgot-password)
  └── enqueueEmail(type, to, data)        ← always call this, never EmailService directly
        ├── EMAIL_QUEUE=true  → BullMQ → emailWorker → EmailService.sendTemplate()
        └── EMAIL_QUEUE unset → inline fire-and-forget (local dev, no Redis needed)

EmailService.sendTemplate(type, to, data)
  └── templates/index.ts (registry)
        ├── email-verification.template.ts
        ├── password-reset.template.ts
        └── login-otp.template.ts
              └── base.layout.ts + partials/otp-block.partial.ts
  └── SmtpDriver (nodemailer → Brevo SMTP)
```

### Adding a new email type

1. Create `src/services/email/templates/your-type.template.ts` — export `subject`, `html(data)`, `text(data)` and a typed data interface.
2. In `templates/index.ts`: add to `EmailType`, `EmailDataMap`, and the `templates` map.
3. Call `await enqueueEmail('your-type', to, data)`.

### Email worker

The worker runs as a separate process alongside the API:

```bash
pnpm worker        # production: node dist/workers/emailWorker.js
pnpm worker:dev    # dev:        tsx src/workers/emailWorker.ts
```

Job config: 3 attempts, exponential backoff (5s → 10s → 20s). Failed jobs retained for 500 entries, completed for 100.

---

## Database Configuration

### Model routing

| Model | Database |
|-------|----------|
| User, Otp, Token | SQL (configured via `SQL_DB`) |
| Post, Comment, Like | MongoDB |

### SQL databases

| Database | `SQL_DB` | Notes |
|----------|----------|-------|
| MySQL | `mysql` | Default |
| PostgreSQL | `postgres` | Recommended for production |
| SQLite | `sqlite` | Zero-setup for local dev and tests |

---

## Available Scripts

### Development

| Script | Description |
|--------|-------------|
| `pnpm dev` | Hot reload via `tsx --watch` |
| `pnpm build` | Compile TypeScript → `dist/` |
| `pnpm start` | Run `dist/index.js` |
| `pnpm worker` | Run email worker (production) |
| `pnpm worker:dev` | Run email worker (dev, tsx) |
| `pnpm lint` | Type-check only (`tsc --noEmit`) |

### Database

| Script | Description |
|--------|-------------|
| `pnpm migrate:create` | New migration file |
| `pnpm migrate:up` | Run pending migrations |
| `pnpm migrate:down` | Rollback last batch |
| `pnpm migrate:status` | Show status |
| `pnpm db:reset` | Drop → migrate → seed |
| `pnpm db:seed` | Seed test data |
| `pnpm db:drop` | Drop all tables |

### Testing

| Script | Description |
|--------|-------------|
| `pnpm test` | Run all tests (sequential) |
| `pnpm test:watch` | Watch mode |
| `pnpm test:coverage` | Coverage report |

---

## Environment Variables

### Required

```env
PORT=4000
NODE_ENV=development          # development | staging | production | test
JWT_SECRET=                   # min 32 chars in production
MONGO_URI=mongodb://localhost:27017
SQL_DB=mysql                  # mysql | postgres | sqlite
```

### SQL (choose one)

```env
# MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=x_socials
MYSQL_USER=root
MYSQL_PASSWORD=secret

# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=x_socials
PG_USER=postgres
PG_PASSWORD=secret
PG_SSL=false

# SQLite
SQLITE_FILENAME=./data/x_socials.sqlite
```

### Email (SMTP — Brevo or any provider)

```env
SMTP_HOST=smtp-relay.brevo.com   # Brevo relay host
SMTP_PORT=587                    # 587 (STARTTLS) or 465 (SSL)
SMTP_USER=your-brevo-login@example.com
SMTP_KEY=your-brevo-smtp-key     # Settings → SMTP & API → SMTP tab
SMTP_FROM=noreply@x-socials.com
```

### Queue & Redis

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Controls email delivery mode:
#   unset / false → inline fire-and-forget (local dev, no Redis needed)
#   true          → BullMQ queue via emailWorker (staging / production)
EMAIL_QUEUE=false
```

### Optional

```env
JWT_EXPIRES_IN=7d
DB_MODE=split                 # split | single
AUTO_MIGRATE=false
ENABLE_SWAGGER=true
SERVER_MAINTENANCE=false
PROMETHEUS_METRICS_PORT=9464
LOG_DAYS=14
```

---

## Testing

Service tests use repo fakes — no real database needed:

```ts
function makeFactory(overrides = {}) {
  const repo = { findById: vi.fn().mockResolvedValue(entity), ...overrides };
  return { getRepository: vi.fn(() => repo), _repo: repo };
}
```

Queue calls are mocked at the module boundary:

```ts
vi.mock('../../queue/emailQueue', () => ({
  enqueueEmail: vi.fn().mockResolvedValue(undefined),
}));
```

Coverage thresholds: 65% statements/functions/lines, 55% branches.

---

## CI/CD

GitHub Actions runs on every push: type-check → test with coverage upload → security audit → build. Staging deploys automatically after CI passes; production requires approval.

---

## Related Services

| Service | Role |
|---------|------|
| [x-socials-web](https://github.com/codedsultan/x-socials-web) | Next.js frontend |
| [x-socials-admin](https://github.com/codedsultan/x-socials-admin) | Laravel admin panel — review queue, dashboard |
| [x-socials-moderator](https://github.com/codedsultan/x-socials-ai-moderator) | FastAPI AI moderation engine |

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Author

**Olusegun Ibraheem**
- Website: [codesultan.xurl.fyi](https://codesultan.xurl.fyi)
- Email: codesultan369@gmail.com
