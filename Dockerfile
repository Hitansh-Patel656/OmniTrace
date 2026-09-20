# Multi-stage build for OmniTrace API Backend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and tsconfig
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source and data files
COPY src ./src
COPY data ./data

# Compile TypeScript to dist/
RUN npm run build

# Production runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled files and data schema
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data

EXPOSE 3001

# Healthcheck for container orchestrators (Render, Docker, Kubernetes)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/src/index.js"]
