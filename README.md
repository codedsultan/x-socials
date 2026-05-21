# X-Socials API

[![codecov](https://codecov.io/gh/codedsultan/x-socials/branch/main/graph/badge.svg)](https://codecov.io/gh/codedsultan/x-socials/branch/main/graph/badge.svg)
[![Node.js Version](https://img.shields.io/badge/node-20%2B-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.0-orange)](https://pnpm.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A robust Node.js TypeScript application with Express, featuring multi-database support (MongoDB + SQL), environment-based configuration, comprehensive logging, Swagger documentation, and CI/CD pipelines.

---

## Features

- **TypeScript** — Type-safe code with full TypeScript support
- **Express.js** — Fast, unopinionated web framework
- **Multi-Database Architecture** — MongoDB for document storage + configurable SQL database (MySQL/PostgreSQL/SQLite)
- **Environment Configuration** — Development, Staging, and Production environments
- **Swagger/OpenAPI** — Automatic API documentation
- **Winston Logger** — Structured logging with environment-based formatting
- **Database Migrations** — CLI-based migrations with rollback support
- **Repository Pattern** — Clean separation of data access logic
- **Testing** — Vitest for unit and integration tests
- **pnpm** — Fast, disk-efficient package manager
- **CI/CD Ready** — GitHub Actions workflows for automated testing and deployment

---

## Prerequisites

- Node.js v20 or higher
- pnpm v10 or higher (`npm install -g pnpm`)
- MongoDB (required)
- One SQL database: MySQL, PostgreSQL, or SQLite (SQLite works out of the box)

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/codedsultan/x-socials
cd x-socials

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start development server
pnpm dev
```

---

## Database Configuration

The application supports MongoDB + one SQL database of your choice. SQL database is configured via the `SQL_DB` environment variable.

### Supported SQL Databases

| Database | `SQL_DB` value | Development | Production |
|----------|---------------|-------------|------------|
| MySQL | `mysql` | ✅ Default | ✅ |
| PostgreSQL | `postgres` | ✅ (via `SQL_DB=postgres`) | ✅ Recommended |
| SQLite | `sqlite` | ✅ (testing/lightweight) | ❌ Not recommended |

### Example Configurations

**Development with MySQL (default)**
```env
SQL_DB=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=x_socials_dev
MYSQL_USER=root
MYSQL_PASSWORD=yourpassword
```

**Development with PostgreSQL**
```env
SQL_DB=postgres
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=x_socials_dev
PG_USER=postgres
PG_PASSWORD=yourpassword
PG_SSL=false
```

**Production with PostgreSQL**
```env
SQL_DB=postgres
PG_HOST=cluster-production-shared-postgres
PG_PORT=5432
PG_DATABASE=x_socials_production
PG_USER=x_socials
PG_PASSWORD=${PG_PASSWORD}
PG_SSL=true
```

**Testing with SQLite (fast, no setup)**
```env
SQL_DB=sqlite
SQLITE_FILENAME=./data/test.sqlite
```

### Model Routing

All SQL models (User, Otp, Token) use the same configured SQL database. MongoDB is used for document-based models (Post, Comment, Like).

---

## Available Scripts

### Development
| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Compile TypeScript to JavaScript |
| `pnpm start` | Start production server |

### Database Migrations
| Script | Description |
|--------|-------------|
| `pnpm migrate:create` | Create a new migration file |
| `pnpm migrate:up` | Run pending migrations |
| `pnpm migrate:down` | Rollback last migration batch |
| `pnpm migrate:status` | Show migration status |
| `pnpm db:reset` | Drop all tables, run migrations, seed data |
| `pnpm db:drop` | Drop all tables |
| `pnpm db:seed` | Seed database with test data |

### Testing
| Script | Description |
|--------|-------------|
| `pnpm test` | Run tests in watch mode |
| `pnpm test:run` | Run tests once |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm test:mysql` | Run tests against MySQL |
| `pnpm test:postgres` | Run tests against PostgreSQL |
| `pnpm test:sqlite` | Run tests against SQLite |
| `pnpm test:mongodb` | Test MongoDB connection and data |

---

## Environment Variables

### Required
```env
PORT=4000                    # Server port
NODE_ENV=development         # development | staging | production | test
SQL_DB=mysql                 # mysql | postgres | sqlite
MONGO_URI=mongodb://localhost:27017
JWT_SECRET=your-secret-key
```

### SQL Database (choose one based on SQL_DB)

**MySQL**
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=x_socials
MYSQL_USER=root
MYSQL_PASSWORD=secret
MYSQL_CLIENT=mysql2
```

**PostgreSQL**
```env
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=x_socials
PG_USER=postgres
PG_PASSWORD=secret
PG_SSL=false
PG_CLIENT=pg
```

**SQLite**
```env
SQLITE_FILENAME=./data/x_socials.sqlite
SQLITE_CLIENT=better-sqlite3
```

### Optional
```env
# Database Mode
DB_MODE=split                # split | single
DEFAULT_DB=mongodb           # Default database for unbound models

# Auto-migrations (default: true in dev, false in prod)
AUTO_MIGRATE=false

# Application
API_BASE_URL=http://localhost:4000
API_PREFIX=/api
CORS_ENABLED=true
ENABLE_SWAGGER=true
SERVER_MAINTENANCE=false

# JWT
JWT_EXPIRES_IN=7d

# Logging
LOG_DAYS=14

# External Services
SENDGRID_API_KEY=your-key
SMTP_FROM=noreply@example.com
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
```

---

## Project Structure

```
x-socials/
├── src/
│   ├── app/
│   │   └── index.ts              # Express app configuration
│   ├── config/
│   │   ├── config.service.ts     # Unified configuration (singleton)
│   │   ├── database.config.ts    # Database container builder
│   │   └── swagger.ts            # Swagger/OpenAPI setup
│   ├── database/
│   │   ├── adapters/
│   │   │   ├── MongooseAdapter.ts   # MongoDB adapter
│   │   │   └── KnexAdapter.ts       # SQL adapter (MySQL/PostgreSQL/SQLite)
│   │   ├── core/
│   │   │   ├── DbRegistry.ts     # Named adapter registry
│   │   │   └── DbResolver.ts     # Model → adapter router
│   │   ├── migrations/           # Migration files
│   │   └── initializer.ts        # Database lifecycle manager
│   ├── repositories/
│   │   ├── BaseRepository.ts     # Base CRUD operations
│   │   ├── UserRepository.ts     # User-specific queries
│   │   ├── PostRepository.ts     # Post-specific queries
│   │   └── ...
│   ├── factories/
│   │   └── RepositoryFactory.ts  # Repository instance factory
│   ├── interfaces/
│   │   └── core/
│   │       ├── config.ts         # TypeScript interfaces
│   │       ├── db-types.ts       # Database type definitions
│   │       └── IAdapter.ts       # Adapter interface
│   ├── middlewares/              # Express middleware
│   ├── exceptions/               # Error handling
│   ├── logger/                   # Winston logger
│   ├── models/                   # Schema definitions
│   └── index.ts                  # Application entry point
├── scripts/
│   ├── db/                       # Database management scripts
│   │   ├── drop.ts
│   │   ├── reset.ts
│   │   ├── seed.ts
│   │   └── update-likes.ts
│   └── migrations/               # Migration CLI scripts
│       ├── create.ts
│       ├── up.ts
│       ├── down.ts
│       └── status.ts
├── src/__tests__/                # Test files
├── .github/workflows/            # CI/CD pipelines
├── .env.example
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## API Endpoints

**Base URL:** `http://localhost:4000`

### Health & Status
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Welcome message with environment info |
| GET | `/health` | Server health + database status |
| GET | `/ready` | Kubernetes readiness probe |
| GET | `/live` | Kubernetes liveness probe |

### API Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/environment` | Current environment configuration |
| GET | `/api/users` | Get all users |
| GET | `/api/posts` | Get all posts |
| GET | `/api/posts/:id` | Get single post |
| POST | `/api/posts` | Create a new post |
| PUT | `/api/posts/:id` | Update a post |
| DELETE | `/api/posts/:id` | Delete a post |
| POST | `/api/posts/:id/like` | Like a post |
| GET | `/api/posts/author/:authorId` | Get posts by author |
| GET | `/api/posts/tag/:tag` | Get posts by tag |

### Documentation
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api-docs` | Swagger UI (dev/staging only) |
| GET | `/api-docs.json` | Swagger JSON specification |

### Example Responses

**GET `/health`**
```json
{
  "status": "OK",
  "environment": "development",
  "maintenance": false,
  "database": {
    "mongodb": true,
    "mysql": true
  },
  "timestamp": "2026-05-13T17:30:00.000Z",
  "version": "1.0.0"
}
```

**GET `/api/posts`**
```json
{
  "posts": [
    {
      "id": "019e23ab-ae34-759f-a6be-04a6f554b409",
      "title": "Welcome to the Platform!",
      "content": "This is your first post...",
      "authorId": "user1-id",
      "tags": ["welcome", "introduction"],
      "likesCount": 5,
      "createdAt": "2026-05-13T17:28:34.000Z",
      "updatedAt": "2026-05-13T17:28:34.000Z"
    }
  ],
  "count": 3
}
```

---

## Database Migrations

### Creating Migrations
```bash
# Create a new migration
pnpm migrate:create create_users_table
```

### Running Migrations
```bash
# Run all pending migrations
pnpm migrate:up

# Check migration status
pnpm migrate:status

# Rollback last batch
pnpm migrate:down

# Rollback 3 batches
pnpm migrate:down 3

# Rollback all migrations
pnpm migrate:down --all
```

### Complete Reset
```bash
# Drop all tables, run migrations, seed data
pnpm db:reset

# Reset without seeding
pnpm db:reset --no-seed

# Drop tables only
pnpm db:reset --drop-only
```

---

## Testing

### Run tests with different databases
```bash
# Default (SQLite - fast, no setup)
pnpm test

# Run against MySQL (requires MySQL running)
pnpm test:mysql

# Run against PostgreSQL (requires PostgreSQL running)
pnpm test:postgres

# Run against SQLite
pnpm test:sqlite

# Test MongoDB connection and data
pnpm test:mongodb
```

### Coverage Report
```bash
pnpm test:coverage
```

---

## Migration from PostgreSQL to MySQL

The application supports seamless switching between SQL databases via the `SQL_DB` environment variable:

1. **Update `.env`**:
   ```env
   SQL_DB=mysql  # Change from postgres to mysql
   ```

2. **Update connection details**:
   ```env
   MYSQL_HOST=localhost
   MYSQL_DATABASE=x_socials
   # ... MySQL config
   ```

3. **Reset and migrate**:
   ```bash
   pnpm db:reset
   ```

All SQL models automatically use the configured database - no code changes required!

---

## CI/CD Pipeline

### Continuous Integration
- Installs dependencies via pnpm with cache
- Runs TypeScript type checking
- Executes test suite with coverage upload
- Runs security audit
- Builds the application

### Continuous Deployment (GitHub Actions)
1. **Staging** — Deploys automatically after CI passes
2. **Production** — Deploys after staging approval

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

## Related services

| Service | Role |
|---|---|
| [x-socials-web](https://github.com/codedsultan/x-socials-web) | Next.js 16 frontend for the x-socials API  |
| [x-socials-admin](https://github.com/codedsultan/x-socials-admin) | Laravel admin panel — review queue, dashboard, auto-remove |
| [x-socials-moderator](https://github.com/codedsultan/x-socials-ai-moderator) | FastAPI AI engine — analyses content, writes results |

---

## License

MIT License — see the [LICENSE](LICENSE) file for details.

---

## Author

**Olusegun Ibraheem**
- Website: [codesultan.xurl.fyi](https://codesultan.xurl.fyi)
- Email: codesultan369@gmail.com
