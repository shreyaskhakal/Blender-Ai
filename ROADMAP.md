# Development Roadmap & Implementation Plan

**Document Version:** 1.0.0  
**Status:** Baseline Plan Approved  
**Planning Model:** Dependency-Gated Stages (Stage 0 through Stage 9)  

---

## Stage Overview

| Stage | Focus Area | Status | Primary Dependencies |
| :--- | :--- | :--- | :--- |
| **Stage 0** | Repository Audit, Architecture & Documentation | **Complete (Current)** | Clean repository clone |
| **Stage 1** | Project Scaffolding, Tooling & Database Foundation | Pending Approval | Stage 0 |
| **Stage 2** | Image Upload & Secure Object Storage Pipeline | Planned | Stage 1 |
| **Stage 3** | Tripo3D Provider Adapter & Async Worker Polling | Planned | Stage 1, Stage 2 |
| **Stage 4** | Asset Validation, Durable Storage & WebGL 3D Preview | Planned | Stage 3 |
| **Stage 5** | Asset Library, Downloads & History Management | Planned | Stage 4 |
| **Stage 6** | Blender Python Add-on (`bpy`) Integration | Planned | Stage 5 |
| **Stage 7** | Authentication, User Isolation & Security Hardening | Planned | Stage 6 |
| **Stage 8** | Containerization, CI/CD & End-to-End Testing | Planned | Stage 7 |
| **Stage 9** | Production Release, User Feedback & Enhancements | Planned | Stage 8 |

---

## Detailed Stage Breakdowns

### Stage 0: Repository Audit, Architecture & Documentation Foundation
- **Objective:** Establish the technical baseline, audit the empty repository, verify official Tripo3D API specifications, and author a comprehensive, implementation-ready documentation system.
- **Deliverables:** Complete documentation suite (`README.md`, `PRD.md`, `ARCHITECTURE.md`, `design.md`, `schema.md`, `API.md`, `AGENTS.md`, `ROADMAP.md`, `SECURITY.md`, `DEPLOYMENT.md`, `TESTING.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `.env.example`, `.gitignore`, `docs/*`).
- **Dependencies:** Initial Git repository clone.
- **Acceptance Criteria:** Zero conflicting assumptions; verified Tripo3D OpenAPI v3 contracts; consistent database schemas and API endpoints; passing markdown and Mermaid syntax checks.
- **Test Requirements:** Document cross-consistency review and Markdown verification.
- **Risks:** Scope misalignment prior to implementation. (Mitigated by Stage 0 approval gate).

---

### Stage 1: Project Scaffolding, Tooling & Database Foundation
- **Objective:** Scaffold the monorepo workspace, configure TypeScript and Python tooling, implement PostgreSQL schema migrations, and spin up local infrastructure via Docker Compose.
- **Deliverables:**
  - `pnpm-workspace.yaml`, root `package.json`, `docker-compose.yml` (PostgreSQL, Redis, MinIO).
  - Database package (`packages/database`) with Prisma schema and initial migration.
  - Basic Fastify/Express server scaffold (`apps/api`) with `/api/v1/health`.
- **Dependencies:** Stage 0.
- **Acceptance Criteria:** `docker-compose up -d` boots cleanly; `pnpm migrate` applies database tables; `/api/v1/health` returns HTTP 200 with database and Redis connected.
- **Test Requirements:** Database connectivity test, healthcheck endpoint integration test.
- **Risks:** Port conflicts with existing local services.

---

### Stage 2: Image Upload & Secure Object Storage Pipeline
- **Objective:** Build the image ingestion pipeline, supporting drag-and-drop intake, MIME and magic-byte validation, and pre-signed uploads to S3 storage.
- **Deliverables:**
  - `packages/storage` S3 client adapter.
  - Endpoints `POST /api/v1/uploads` and `POST /api/v1/uploads/:id/complete`.
  - Frontend upload dropzone in `apps/web` with client-side image preview.
- **Dependencies:** Stage 1.
- **Acceptance Criteria:** Uploads up to 20MB succeed; non-image files and spoofed extensions are rejected; validated files appear in MinIO/S3.
- **Test Requirements:** Unit tests for magic-byte verification (PNG/JPEG); upload integration tests.
- **Risks:** Bypassing validation with crafted image headers. (Mitigated by backend magic-byte check).

---

### Stage 3: Tripo3D Provider Adapter & Async Worker Polling
- **Objective:** Implement the Tripo3D OpenAPI v3 client (`packages/tripo3d`), BullMQ queue worker (`apps/worker`), and task polling state machine.
- **Deliverables:**
  - `packages/tripo3d` with both live client (`Tripo3DClient`) and mock adapter (`Tripo3DMockClient`).
  - Worker process handling job enqueuing, Tripo file upload, task submission, and polling loop.
  - Endpoint `POST /api/v1/generation-jobs` and `GET /api/v1/generation-jobs/:id`.
- **Dependencies:** Stage 1, Stage 2.
- **Acceptance Criteria:** Worker submits jobs, tracks progress (0–100%), and retries transient network errors; mock adapter runs cleanly without credit cost.
- **Test Requirements:** Worker integration tests with `Tripo3DMockClient`; retry and timeout tests.
- **Risks:** Unintentional live API credit consumption during test runs. (Enforced `TRIPO3D_USE_MOCK=true`).

---

### Stage 4: Asset Validation, Durable Storage & WebGL 3D Preview
- **Objective:** Implement the CDN asset ingestion worker, persist `.glb` models and rendered thumbnails to durable storage, and build the Three.js 3D viewport.
- **Deliverables:**
  - Worker streaming routine piping Tripo CDN models into private storage before the 5-minute TTL expires.
  - GLB magic-byte inspection (`glTF`).
  - Three.js WebGL canvas in `apps/web` with OrbitControls, PBR materials, lighting presets, and wireframe toggle.
- **Dependencies:** Stage 3.
- **Acceptance Criteria:** Assets saved to private storage; interactive 3D model renders smoothly in browser at 60 FPS.
- **Test Requirements:** GLB binary validation test; WebGL canvas render smoke test.
- **Risks:** Heavy 3D models degrading browser frame rate. (Mitigated by face-limit controls).

---

### Stage 5: Downloads, Asset Library & History Management
- **Objective:** Provide a paginated gallery for browsing previous generations, asset metadata inspection, temporary signed download links, and deletion.
- **Deliverables:**
  - Endpoints `GET /api/v1/assets`, `GET /api/v1/assets/:id`, `GET /api/v1/assets/:id/download`, `DELETE /api/v1/assets/:id`.
  - Frontend Asset Library view with search, filter, and pagination.
- **Dependencies:** Stage 4.
- **Acceptance Criteria:** Users can browse past assets, download `.glb` files with signed URLs, and delete assets cleanly.
- **Test Requirements:** Asset authorization tests (preventing unauthorized access); download signed URL validity test.
- **Risks:** Leaking unauthorized asset access. (Enforced user ownership checks).

---

### Stage 6: Blender Python Add-on (`bpy`) Integration
- **Objective:** Develop the native Blender add-on enabling artists to browse and import generated assets directly inside Blender's 3D Viewport.
- **Deliverables:**
  - Python package in `blender_addon/blender_ai`.
  - N-panel UI in 3D Viewport with API key preference configuration.
  - One-click import calling `bpy.ops.import_scene.gltf` with auto-centering and ground alignment.
- **Dependencies:** Stage 5.
- **Acceptance Criteria:** Compatible with Blender 3.6 LTS and 4.x; imports `.glb` models with correct scale and materials.
- **Test Requirements:** Headless Blender test script (`blender --background --python ...`).
- **Risks:** Compatibility discrepancies between Blender versions.

---

### Stage 7: Authentication, User Isolation & Security Hardening
- **Objective:** Finalize user authentication, API token issuance, rate limiting, and security defenses.
- **Deliverables:**
  - User registration, login, and personal API token generation (`bai_...`).
  - Rate-limiting middleware on generation routes.
  - Secret scanning and automated security headers (Helmet, strict CORS).
- **Dependencies:** Stage 6.
- **Acceptance Criteria:** Strict data isolation between accounts; no unauthenticated access to generation or download endpoints.
- **Test Requirements:** Security scan (`npm audit`), auth boundary test suite.
- **Risks:** Leaked user tokens. (Mitigated by hashed storage and instant token revocation).

---

### Stage 8: Containerization, CI/CD & End-to-End Testing
- **Objective:** Package the entire system into optimized multi-stage Docker containers and run end-to-end automated pipelines.
- **Deliverables:**
  - Production `Dockerfile`s for API, worker, and web frontend.
  - Playwright E2E test suite simulating the full workflow from image upload to mock 3D render.
  - GitHub Actions CI workflow running linting, type checks, unit tests, and container builds.
- **Dependencies:** Stage 7.
- **Acceptance Criteria:** Automated CI build passes cleanly; one-command Docker deployment succeeds.
- **Test Requirements:** Full Playwright E2E test run against local stack.
- **Risks:** Container build bloat. (Mitigated by multi-stage Docker builds).

---

### Stage 9: User Validation, Feedback & Enhancements
- **Objective:** Deploy to staging, conduct usability testing with 3D artists, gather performance telemetry, and plan v0.2 features.
- **Deliverables:** User feedback summary report, bug fixes, performance tuning for 3D viewer.
- **Dependencies:** Stage 8.
- **Acceptance Criteria:** Real user validation with positive feedback on Blender import workflow.
- **Test Requirements:** Production smoke test with genuine Tripo3D credentials.
- **Risks:** User confusion over AI reconstruction limitations. (Addressed by UI tooltips and onboarding guidance).
