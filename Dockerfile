# Multi-stage build for optimal image size
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Debug: List files to verify src exists
# RUN ls -la && ls -la src/ || echo "src directory not found"

# # Build the application (includes compiling TypeScript)
RUN pnpm build

# RUN echo "=== Copying database assets ===" && \
#     mkdir -p database/migrations && \
#     cp -r database/migrations database/ && \
#     cp -r database/seeds database/ && \
#     cp -r database/scripts database/

# # # IMPORTANT: Also compile migration scripts (ignoring tsconfig.json)
# RUN mkdir -p dist/scripts && \
#     npx tsc scripts/migrations/*.ts --outDir dist/scripts --esModuleInterop --resolveJsonModule --skipLibCheck --ignoreConfig && \
#     npx tsc scripts/db/*.ts --outDir dist/scripts --esModuleInterop --resolveJsonModule --skipLibCheck --ignoreConfig

# # RUN npx tsc -p tsconfig.scripts.json
# IMPORTANT: Also compile migration scripts
# RUN mkdir -p dist && \
#     npx tsc scripts/**/*.ts \
#     --outDir dist \
#     --target ES2022 \
#     --module CommonJS \
#     --moduleResolution bundler \
#     --esModuleInterop \
#     --resolveJsonModule \
#     --skipLibCheck \
#     --ignoreConfig

# npx tsc scripts/**/*.ts \
# --outDir dist \
# --target ES2022 \
# --module ES2022 \
# --moduleResolution bundler \
# --esModuleInterop \
# --resolveJsonModule \
# --skipLibCheck \
# --ignoreConfig

# Verify build output
# RUN echo "=== Verifying build output ===" && \
#     if [ ! -f "dist/index.js" ]; then \
#     echo "ERROR: dist/index.js not found!" && \
#     echo "dist contents:" && \
#     ls -la dist/ && \
#     exit 1; \
#     fi && \
#     echo "✅ Main app compiled successfully" && \
#     echo "Top level dist files:" && \
#     ls -la dist/*.js 2>/dev/null | head -5 && \
#     echo "Config directory:" && \
#     ls -la dist/config/

# Copy database assets to database/ (NOT inside dist/)
# This keeps database/ and dist/ as siblings
# RUN echo "=== Copying database assets ===" && \
#     mkdir -p database/migrations && \
#     cp -r database/migrations database/migrations  2>/dev/null || true && \
#     cp -r database/seeds database/seeds 2>/dev/null || echo "No seeds directory"

# Compile knexfile.ts to database/ (NOT inside dist/)
# RUN echo "=== Compiling knexfile ===" && \
#     npx tsc knexfile.ts \
#     --outDir dist \
#     --target ES2022 \
#     --module CommonJS \
#     --moduleResolution bundler \
#     --esModuleInterop \
#     --resolveJsonModule \
#     --skipLibCheck \
#     --ignoreConfig

# Compile database scripts to database/scripts/ (NOT inside dist/)
# RUN echo "=== Compiling database scripts ===" && \
#     mkdir -p database/scripts && \
#     npx tsc database/scripts/**/*.ts \
#     --outDir database/scripts \
#     --target ES2022 \
#     --module CommonJS \
#     --moduleResolution bundler \
#     --esModuleInterop \
#     --resolveJsonModule \
#     --skipLibCheck \
#     --ignoreConfig

# Compile database scripts preserving directory structure
# RUN echo "=== Compiling database scripts ===" && \
#     mkdir -p database/scripts && \
#     npx tsc database/scripts/migrations/*.ts \
#     --outDir database/scripts/migrations \
#     --target ES2022 \
#     --module CommonJS \
#     --moduleResolution bundler \
#     --esModuleInterop \
#     --resolveJsonModule \
#     --skipLibCheck \
#     --ignoreConfig && \
#     npx tsc database/scripts/db/*.ts \
#     --outDir database/scripts/db \
#     --target ES2022 \
#     --module CommonJS \
#     --moduleResolution bundler \
#     --esModuleInterop \
#     --resolveJsonModule \
#     --skipLibCheck \
#     --ignoreConfig

# # Final verification - shows both dist/ and database/ as siblings
# RUN echo "=== Final verification ===" && \
#     echo "📁 Project root contents:" && \
#     ls -la && \
#     echo "" && \
#     echo "📁 App code (dist/):" && \
#     ls -la dist/ | head -10 && \
#     echo "" && \
#     echo "📁 Database assets (database/):" && \
#     ls -la database/ && \
#     echo "" && \
#     echo "📁 Database migrations:" && \
#     ls -la database/migrations/ | head -5 && \
#     echo "" && \
#     echo "📁 Database scripts:" && \
#     ls -la database/scripts/migrations/ | head -5

# Remove dev dependencies
RUN pnpm prune --prod

# Production stage
FROM node:22-alpine AS app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/src ./src 
COPY --from=builder --chown=nodejs:nodejs /app/database ./database
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Copy health check script
COPY --chown=nodejs:nodejs healthcheck.js ./

RUN pnpm add tsx
# Switch to non-root user
USER nodejs

# Expose application and metrics ports
EXPOSE 5000 9464

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]