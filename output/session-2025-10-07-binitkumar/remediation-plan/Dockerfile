FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Create necessary directories
RUN mkdir -p ./state ./logs ./remediation-plan ./input ./uploads

# Copy application files
COPY dist/ ./dist/
COPY config/ ./config/

# Set environment variables
ENV NODE_ENV=production
ENV INTEGRATION_API_URL=${INTEGRATION_API_URL:-http://localhost:3001/api}
ENV API_AUTH_TOKEN=${API_AUTH_TOKEN:-dev-token}

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S integration-auditor -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R integration-auditor:nodejs /app

# Switch to non-root user
USER integration-auditor

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run persistent remediation server
CMD ["node", "dist/server/remediation-server.js"]
