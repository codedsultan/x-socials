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
RUN ls -la && ls -la src/ || echo "src directory not found"

# Build the application (includes compiling TypeScript)
RUN pnpm build


# Copy database assets (migrations, seeds) to dist
RUN mkdir -p dist/database && \
    cp -r database/migrations dist/database/ && \
    cp -r database/seeds dist/database/ 2>/dev/null || true

# Compile knexfile.ts to knexfile.js in dist
RUN npx tsc knexfile.ts \
    --outDir dist \
    --target ES2022 \
    --module CommonJS \
    --moduleResolution node16 \
    --esModuleInterop \
    --resolveJsonModule \
    --skipLibCheck \
    --ignoreConfig

# Compile database scripts (the runner scripts, not migration templates)
RUN mkdir -p dist/database/scripts && \
    npx tsc database/scripts/**/*.ts \
    --outDir dist/database/scripts \
    --target ES2022 \
    --module CommonJS \
    --moduleResolution node16 \
    --esModuleInterop \
    --resolveJsonModule \
    --skipLibCheck \
    --ignoreConfig

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

# # Debug: List compiled files to verify
# RUN ls -la dist/scripts/ && \
#     ls -la dist/scripts/migrations/ || echo "No migrations folder" && \
#     ls -la dist/scripts/db/ || echo "No db folder"

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
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Copy health check script
COPY --chown=nodejs:nodejs healthcheck.js ./

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