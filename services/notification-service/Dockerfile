# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy monorepo config files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./

# Copy package.json files for lockfile installation
COPY packages/shared/package.json ./packages/shared/
COPY packages/telemetry/package.json ./packages/telemetry/
COPY packages/kafka-client/package.json ./packages/kafka-client/
COPY services/notification-service/package.json ./services/notification-service/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/telemetry ./packages/telemetry
COPY packages/kafka-client ./packages/kafka-client
COPY services/notification-service ./services/notification-service

# Build the service
RUN pnpm run build --filter @ewap/notification-service...

# Production stage
FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/notification-service ./services/notification-service

WORKDIR /app/services/notification-service
EXPOSE 4004

CMD ["node", "dist/index.js"]
