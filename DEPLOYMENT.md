# Deployment & Operational Runbook

**Document Version:** 1.0.0  
**Status:** Approved Operational Guide  
**Infrastructure Model:** Docker Containerized Services  

---

## 1. Architecture & Service Inventory

Blender AI comprises the following deployable components:

| Service | Runtime | Process Type | Persistent Storage |
| :--- | :--- | :--- | :--- |
| **`web`** | Nginx / Static CDN | Web Client | None (Stateless) |
| **`api`** | Node.js 20 LTS | HTTP Server (Fastify) | None (Stateless) |
| **`worker`** | Node.js 20 LTS | Background Daemon | None (Stateless) |
| **`postgres`** | PostgreSQL 16 | Relational Database | Persistent Volume (`/var/lib/postgresql/data`) |
| **`redis`** | Redis 7 Alpine | Queue & Cache | Persistent Volume (`/data` with AOF enabled) |
| **`storage`** | MinIO (Dev) / S3 | Object Storage | Persistent Volume (Dev) / Cloud S3 Bucket (Prod) |

> [!NOTE]
> The web frontend host is **not** capable of running GPU inference or persistent background tasks. All asynchronous queue operations must run on a dedicated worker process with continuous network connectivity to Redis and external APIs.

---

## 2. Local Development Deployment (Docker Compose)

The fastest way to spin up the entire dependency stack locally:

### 2.1 Prerequisites
- Docker Engine `>= 24.0` and Docker Compose v2.
- Node.js `>= 20.x` and `pnpm >= 9.x`.

### 2.2 Setup Steps
```bash
# 1. Clone repository (already completed)
cd Blender-Ai

# 2. Configure local environment
cp .env.example .env

# 3. Start local infrastructure services (Postgres, Redis, MinIO)
docker compose up -d postgres redis minio

# 4. Install dependencies
pnpm install

# 5. Run database migrations
pnpm --filter @blender-ai/database prisma migrate dev

# 6. Start all applications in watch mode
pnpm dev
```

Local service URLs:
- Web App: `http://localhost:5173`
- REST API: `http://localhost:4000` (Healthcheck: `http://localhost:4000/api/v1/health`)
- MinIO Storage Console: `http://localhost:9001` (Credentials: `minioadmin` / `minioadmin`)

---

## 3. Production Deployment Strategy

```
[Internet]
    │
    ▼
[Cloudflare / Cloud Load Balancer (SSL Termination)]
    │
    ├───────────────┬────────────────────────┐
    │ /             │ /api/v1/*              │ /storage/*
    ▼               ▼                        ▼
[Static Web CDN]  [API Container Replicas]  [S3 / Cloudflare R2]
                    │ (Internal Network)
                    ├──► [PostgreSQL Primary]
                    ├──► [Redis Cluster]
                    ▲
                    │
            [Worker Container Replicas] ──► [Tripo3D Cloud API]
```

### 3.1 Backend API & Worker Deployment
- **Containerization:** Built via multi-stage Dockerfiles (`docker/Dockerfile.api`, `docker/Dockerfile.worker`).
- **Scaling:**
  - API nodes scale based on incoming HTTP request rate.
  - Worker nodes scale based on BullMQ queue depth (`jobs_waiting`).
- **Graceful Shutdown:** Both API and worker listen for `SIGTERM` and `SIGINT`, finishing in-flight requests before exiting (30-second shutdown window).

### 3.2 Database Migration Run
Run migrations as a pre-deploy release step:
```bash
pnpm --filter @blender-ai/database prisma migrate deploy
```

### 3.3 S3 Object Storage Configuration
The S3 bucket must have public access blocked and configure CORS for direct uploads:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["https://blender-ai.app"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 4. Health Checks & Monitoring

### 4.1 Health Check Endpoints
- **Liveness Probe:** `GET /api/v1/health/liveness` (Returns 200 if process is running).
- **Readiness Probe:** `GET /api/v1/health` (Returns 200 only if PostgreSQL, Redis, and Object Storage are reachable).

### 4.2 Key Operational Metrics
- **Job Failure Rate:** Alert if `failed_jobs / total_jobs > 5%` over 15 minutes.
- **Queue Wait Time:** Alert if jobs remain in `queued` status for > 30 seconds (indicates insufficient worker capacity).
- **Tripo3D Credit Quota:** Alert when remaining Tripo credits drop below threshold.

---

## 5. Backup & Disaster Recovery

- **PostgreSQL Database:** Automated daily snapshots with continuous WAL archiving (Point-in-Time Recovery enabled).
- **Object Storage:** Cross-region replication enabled on the production asset bucket.
- **Rollback Procedure:** If a new deployment fails, revert to the previous container image tag. Migrations must maintain backward compatibility for at least one version to allow seamless rollback.
