# 백엔드 Dockerfile
FROM node:18-alpine AS base

# Install dependencies for native modules and security updates
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    libc6-compat \
    dumb-init

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy source code
COPY --chown=nextjs:nodejs . .

# Build application (if needed)
RUN npm run build || echo "No build script found"

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:prod"]
