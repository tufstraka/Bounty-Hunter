# FixFlow Frontend Dockerfile
# Next.js application for the bounty hunter dashboard

FROM node:20-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init libc6-compat

# ============================================
# Dependencies Stage
# ============================================
FROM base AS deps

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install since package-lock.json may not exist)
RUN npm install && npm cache clean --force

# ============================================
# Builder Stage
# ============================================
FROM base AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code (including .env file if present)
COPY . .

# Set build-time environment variables
# Priority: 1. Build args (from docker-compose), 2. .env file, 3. defaults
# NEXT_PUBLIC_* must be available at build time for Next.js

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Create public directory if it doesn't exist (for Next.js)
RUN mkdir -p public

# Build the Next.js application
# The .env file is automatically read by Next.js during build
# This ensures NEXT_PUBLIC_* variables are baked into the client bundle
RUN npm run build

# ============================================
# Production Stage
# ============================================
FROM base AS production

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create public directory
RUN mkdir -p public && chown nextjs:nodejs public

# Copy public directory from builder (may be empty)
COPY --from=builder /app/public ./public

# Set correct permissions for prerender cache
RUN mkdir .next && chown nextjs:nodejs .next

# Copy the standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Use non-root user
USER nextjs

# Expose the application port
EXPOSE 3001

# Set the port environment variable
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001 || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]