# Enterprise Workflow Automation Platform

A production-grade multi-tenant workflow automation platform combining the workflow automation of Salesforce Flow, the task management of Jira, and the IT process automation of ServiceNow.

## Tech Stack

- **Runtime**: Node.js 20+, TypeScript 5.4+
- **Package Manager**: pnpm workspaces
- **Database**: PostgreSQL 16 with tenant schemas
- **Cache**: Redis 7
- **Message Broker**: Apache Kafka (Confluent Platform 7.6)
- **Search**: Elasticsearch 8.13
- **Observability**: OpenTelemetry, Jaeger, Prometheus, Grafana
- **ORM**: Prisma
- **Validation**: Zod

## Services

- **api-gateway**: API Gateway (Port 4000)
- **auth-service**: Authentication & Authorization (Port 4001)
- **workflow-service**: Workflow Engine & State Machine (Port 4002)
- **task-service**: Task Management (Port 4003)
- **notification-service**: Email, Slack, In-App Notifications (Port 4004)
- **analytics-service**: Analytics & Reporting (Port 4005)
- **ai-service**: AI-Powered Workflow Generation (Port 4006)
- **audit-service**: Audit Logging (Port 4007)

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

### Installation

```bash
# Install dependencies
pnpm install

# Start infrastructure
cd infrastructure/docker
docker-compose up -d

# Create Kafka topics
docker-compose exec kafka bash /kafka/create-topics.sh

# Build all services
pnpm build

# Start development
pnpm dev
```

### Infrastructure URLs

- **Kafka UI**: http://localhost:8080
- **Jaeger**: http://localhost:16686
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001
- **Elasticsearch**: http://localhost:9200

## Project Structure

```
ewap/
├── packages/
│   ├── shared/          # Shared types, constants, utils
│   ├── kafka-client/    # Kafka producer/consumer wrapper
│   └── telemetry/       # OpenTelemetry initialization
├── services/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── workflow-service/
│   ├── task-service/
│   ├── notification-service/
│   ├── analytics-service/
│   ├── ai-service/
│   └── audit-service/
├── frontend/
├── e2e/
└── infrastructure/
    ├── docker/
    ├── k8s/
    ├── prometheus/
    └── grafana/
```

## License

MIT
