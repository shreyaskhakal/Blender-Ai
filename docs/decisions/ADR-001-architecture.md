# ADR-001: Modular Monolith with Asynchronous Job Worker & Storage Strategy

**Status:** Accepted  
**Date:** 2026-10-19  
**Decision Makers:** Principal Software Architect, DevEx Lead  
**Tags:** architecture, async-queue, storage, tripo3d, blender-addon  

---

## 1. Context & Problem Statement

**Blender AI** allows users to upload a 2D reference image, triggers 3D asset generation using the hosted Tripo3D API, renders an interactive WebGL 3D preview in the browser, stores the generated asset durably, and provides direct one-click import into Blender via a Python add-on.

3D generation takes anywhere from **15 to 120 seconds**, occasionally longer depending on cloud GPU queue depth. Web browsers and typical serverless reverse proxies (e.g. Vercel, AWS API Gateway, Cloudflare Workers) terminate HTTP connections that remain open for longer than 15–30 seconds.

Furthermore, Tripo3D's CDN download links expire in approximately **5 minutes**. If clients or Blender add-ons attempt to download assets beyond this window, requests fail.

We must select an application architecture, task execution model, and storage strategy that:
1. Prevents HTTP request timeouts during 3D generation.
2. Isolates the third-party provider secret (`TRIPOSR_API_KEY`).
3. Guarantees durable asset persistence before client notification.
4. Keeps the codebase simple, modular, and maintainable without unnecessary microservice overhead.

---

## 2. Decision Drivers

- **Reliability:** Long-running generation must not fail if a user closes their browser or experiences a brief network interruption.
- **Provider Decoupling:** Tripo3D's API contract and SDK should be isolated behind a clear provider adapter so other providers or self-hosted models could be swapped in without touching frontend or database code.
- **Developer Experience:** A single developer or AI agent should be able to run and test the entire stack locally with minimal overhead using `docker-compose`.
- **Security:** Zero exposure of provider API keys to browser clients or the Blender add-on.

---

## 3. Considered Alternatives

### Alternative A: Full Microservices (API Service, Worker Service, Blender Sync Service, Auth Service)
- *Pros:* Independent horizontal autoscaling per service.
- *Cons:* Heavy operational complexity, gRPC/network overhead, multiple repositories or complex polyrepo CI, distributed tracing required, massive cognitive overhead for an early-stage product.
- *Verdict:* **Rejected** as premature optimization.

### Alternative B: Serverless / Next.js Monolith with Long-Polling API Routes
- *Pros:* Fast initial setup.
- *Cons:* Serverless function execution timeouts (10s–30s on standard tiers); inability to reliably run background polling loops; difficult to coordinate retries and backoff without external queue services.
- *Verdict:* **Rejected** due to hard execution timeout limits.

### Alternative C: Modular Monolith with Separate Asynchronous Worker (Selected)
- A single repository (monorepo) housing:
  - `apps/web`: React + Vite + Three.js client.
  - `apps/api`: Node.js + Fastify/Express REST API.
  - `packages/worker`: BullMQ queue worker running on Node.js with Redis.
  - `packages/tripo3d`: Isolated provider adapter.
  - `blender_addon/blender_ai`: Python add-on connecting to `apps/api`.
- PostgreSQL for relational state and job tracking; S3-compatible storage for image and GLB assets.
- *Verdict:* **Accepted**.

---

## 4. Decision

We adopt **Alternative C (Modular Monolith with BullMQ Asynchronous Worker)**:

1. **Decoupled Job Lifecycle:**
   - Client uploads an image and requests a generation.
   - The API immediately validates the input, inserts a `generation_jobs` record in `queued` state, enqueues a job in Redis, and returns an HTTP 202 Accepted with a `job_id`.
   - The frontend polls `/api/v1/generation-jobs/:id` or subscribes to task updates.
2. **Dedicated Background Worker:**
   - The worker picks up the job from Redis BullMQ.
   - Calls the `Tripo3DAdapter` to upload the image and trigger generation.
   - Periodically polls Tripo3D until completion or timeout (180s cap).
   - Upon success, the worker streams the generated `.glb` and thumbnail from Tripo's temporary CDN into our private S3 bucket.
   - The worker marks the database record as `completed` and attaches the durable asset reference.
3. **Provider Isolation:**
   - `packages/tripo3d` encapsulates all HTTP headers, OpenAPI v3 schemas, and error codes.
   - Provides a `Tripo3DMockClient` for deterministic, zero-cost automated tests.
4. **Blender Integration:**
   - The Blender Python add-on talks exclusively to our `/api/v1` endpoints using a user API token. It never accesses Tripo3D or raw database connections directly.

---

## 5. Consequences

### Positive
- **No HTTP Timeouts:** HTTP endpoints respond in < 150ms.
- **Guaranteed Durability:** Model assets are permanently archived in private storage; Tripo's 5-minute CDN expiration has zero impact on users.
- **Local Dev Simplicity:** Can be spun up with `docker-compose up -d postgres redis minio` and `pnpm dev`.
- **Clean Testability:** BullMQ workers and Tripo adapters can be unit-tested in isolation using mock fixtures without incurring API billing.

### Negative / Trade-offs
- Requires Redis as an additional infrastructure component alongside PostgreSQL.
- Requires deploying two container processes in production (API server and Queue worker).

---

## 6. Risks & Mitigations

- **Risk:** Redis crashes, losing active in-memory job references.  
  *Mitigation:* Enable Redis append-only persistence (AOF) and synchronize job states with PostgreSQL so orphaned jobs can be recovered on worker restart.
- **Risk:** Worker downloads large GLB files causing high memory usage.  
  *Mitigation:* Stream responses directly from the Tripo CDN HTTP response to the S3 upload stream without buffering the entire binary in RAM.

---

## 7. Revisit Triggers

This architecture will be re-evaluated if:
- Generation volume exceeds 10,000 concurrent jobs per hour (necessitating distributed worker clusters with Kubernetes KEDA).
- Tripo3D introduces native webhooks for task completion, removing the need for worker polling.
