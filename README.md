# X-Socials API

[![codecov](https://codecov.io/gh/codedsultan/x-socials/branch/main/graph/badge.svg)]
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
- **Vitest** — Fast unit and integration testing
- **pnpm** — Fast, disk-efficient package manager
- **CI/CD Ready** — GitHub Actions workflows for automated testing and deployment

---

## Prerequisites

- Node.js v18 or higher
- pnpm v8 or higher (`npm install -g pnpm`)

---

## Getting Started

```bash
# Clone the repository
git clone <your-repo-url>
cd social-media-api

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
| `pnpm dev:staging` | Start server in staging mode |
| `pnpm build` | Compile TypeScript to JavaScript |
| `pnpm start` | Start production server |
| `pnpm start:dev` | Run built app in development mode |
| `pnpm start:staging` | Run built app in staging mode |
| `pnpm start:prod` | Run built app in production mode |
| `pnpm test` | Run tests in watch mode |
| `pnpm test:run` | Run tests once |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm test:staging` | Run tests in staging environment |
| `pnpm type-check` | Check TypeScript types without compiling |
| `pnpm clean` | Remove the build directory |

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
│   │   ├── env.ts              # Environment configuration
│   │   └── swagger.ts          # Swagger/OpenAPI setup
│   ├── interfaces/
│   │   └── core/
│   │       └── config.ts       # TypeScript interfaces
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

## API Endpoints

**Base URL:** `http://localhost:5000`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Welcome message with environment info |
| GET | `/health` | Server health check |
| GET | `/api/environment` | Current environment configuration |
| GET | `/api/users` | List of users (example) |
| GET | `/api-docs` | Swagger UI (dev/staging only) |
| GET | `/api-docs.json` | Swagger JSON specification |

### Example Response

```json
{
  "message": "🚀 Development Server - Social Media API",
  "environment": "development",
  "version": "1.0.0",
  "documentation": "/api-docs",
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

## Docker Support (Optional)

```dockerfile
FROM node:18-alpine
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 5000
CMD ["pnpm", "start"]
```

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
