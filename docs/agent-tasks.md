# Specialist Agent Work Orders & Implementation Tickets

**Version:** 1.0.0  
**Status:** Approved for Implementation Staging  
**Coordination Model:** Contract-First, Dependency-Gated Execution  

---

## 1. Agent Coordination & Execution Sequence

To prevent multiple agents from independently altering shared contracts or producing race conditions, execution is divided into dependency gates:

```
[Phase 1: Foundation]
  Agent A (Repo & Foundation)
       │
       ▼
[Phase 2: Core Contracts & Data]
  Agent C (Backend & DB Schema) ──► Shared API & Database contracts locked
       │
       ├─────────────────────────┬─────────────────────────┐
       ▼                         ▼                         ▼
[Phase 3: Parallel Development]
  Agent B (Frontend & Viewer)   Agent D (Tripo3D Worker)   Agent E (Blender Add-on)
       │                         │                         │
       └─────────────────────────┼─────────────────────────┘
                                 ▼
[Phase 4: Verification & Hardening]
  Agent F (QA & Security)
       │
       ▼
[Phase 5: Release]
  Agent G (Integration & Deployment)
```

---

## 2. Work Orders

### Agent A: Repository Foundation & Scaffolding
- **Objective:** Establish the clean monorepo structure, tooling, TypeScript configurations, Python environment, linting/formatting rules, and base CI pipeline.
- **Scope:** Root repository configuration, `pnpm-workspace.yaml`, project directory layout.
- **Files Owned:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.prettierrc`, `.eslintrc.cjs`, `pyproject.toml`, `.github/workflows/ci.yml`.
- **Dependencies:** None (Stage 1 prerequisite).
- **Contracts Owned:** Workspace package exports and scripts (`dev`, `build`, `lint`, `test`).
- **Acceptance Criteria:**
  - `pnpm install` installs workspace dependencies without error.
  - `pnpm lint` and `pnpm test` execute across all packages.
  - CI workflow executes formatting, linting, and build checks on pull requests.
- **Tests:** `pnpm test` smoke test returning success on empty test suites.
- **Expected Output:** Working workspace scaffold with passing CI.
- **Out-of-Scope:** Implementing business logic or API endpoints.

---

### Agent B: Frontend & UI Workspace
- **Objective:** Build the modern, responsive web application and Three.js 3D viewer following the visual direction in `design.md`.
- **Scope:** `apps/web` (Vite + React + TypeScript + Vanilla CSS).
- **Files Owned:** `apps/web/**`.
- **Dependencies:** Agent A (workspace), Agent C (API contract locked).
- **API Contracts Consumed:** `/api/v1/auth/*`, `/api/v1/uploads`, `/api/v1/generation-jobs/*`, `/api/v1/assets/*`.
- **Acceptance Criteria:**
  - Implements the Blender-inspired dark theme (`#101216`, `#171B22`, `#22D3EE`).
  - Drag-and-drop reference image upload with client-side file inspection and preview.
  - Live job generation polling state machine (`queued`, `processing`, `completed`, `failed`).
  - Interactive Three.js WebGL canvas displaying GLB models with OrbitControls, grid floor, lighting controls, and wireframe toggle.
  - Clear distinction between real generated assets and local mock fixtures.
- **Tests:** Component unit tests with Vitest + React Testing Library; WebGL canvas mount tests.
- **Expected Output:** Fully responsive web application ready for API integration.
- **Out-of-Scope:** Direct third-party API calls or queue handling.

---

### Agent C: Backend API & Database Layer
- **Objective:** Implement the PostgreSQL relational database schema, Prisma/Kysely migrations, REST API routes (`/api/v1`), and S3 storage adapter.
- **Scope:** `apps/api/**`, `packages/database/**`, `packages/storage/**`.
- **Files Owned:** `apps/api/**`, `packages/database/**`, `packages/storage/**`.
- **Dependencies:** Agent A (workspace).
- **Contracts Owned:** `schema.md` (tables: `users`, `generation_jobs`, `assets`, `asset_events`, `user_settings`) and `API.md`.
- **Acceptance Criteria:**
  - Database migrations execute cleanly via Prisma / SQL.
  - `/api/v1/health` reports status of API, PostgreSQL, and Redis.
  - Implements image upload validation and pre-signed S3 upload generation.
  - Enqueues generation jobs to Redis BullMQ.
  - Exposes asset query, metadata, and signed download URL endpoints.
- **Tests:** Supertest API integration tests; database model CRUD tests against test database.
- **Expected Output:** Operational REST API with OpenAPI/Swagger documentation.
- **Out-of-Scope:** Tripo3D API polling logic (delegated to Agent D).

---

### Agent D: Tripo3D Integration & Queue Worker
- **Objective:** Implement the standalone Tripo3D API adapter (`packages/tripo3d`) and BullMQ background worker that polls tasks and durably ingests GLB models.
- **Scope:** `packages/tripo3d/**`, `apps/worker/**`.
- **Files Owned:** `packages/tripo3d/**`, `apps/worker/**`.
- **Dependencies:** Agent A (workspace), Agent C (DB and storage client).
- **Contracts Consumed:** `docs/tripo3d-integration.md`, `schema.md` job states.
- **Acceptance Criteria:**
  - Implements official Tripo3D OpenAPI v3: file upload (`POST /v3/files`), generation (`POST /v3/generation/image-to-model`), polling (`GET /v3/tasks/{task_id}`).
  - Uses `TRIPOSR_API_KEY` exclusively from backend environment.
  - Includes a full `Tripo3DMockClient` for deterministic zero-cost testing.
  - Ingests GLB model directly from temporary Tripo CDN (5-min expiration) into private S3 storage before marking jobs as `completed`.
  - Handles retries, rate limits, credit exhaustion (code 2010), and 180s timeouts gracefully.
- **Tests:** Unit tests with mock HTTP responses; worker retry tests; GLB magic-byte verification test.
- **Expected Output:** Robust background worker resilient to network blips and third-party delays.
- **Out-of-Scope:** Frontend rendering or Blender UI.

---

### Agent E: Blender Python Add-on
- **Objective:** Create the native Blender Python add-on enabling artists to browse generated assets and import them directly into their active 3D scene.
- **Scope:** `blender_addon/blender_ai/**`.
- **Files Owned:** `blender_addon/**`.
- **Dependencies:** Agent C (API `/api/v1/assets` and `/api/v1/assets/:id/download`).
- **Acceptance Criteria:**
  - Compatible with Blender 3.6 LTS and Blender 4.x.
  - UI panel registered in Blender's 3D Viewport Sidebar (`N-panel -> Blender AI`).
  - Preferences panel for storing user API key securely in Blender's `addon_preferences`.
  - Fetches user asset gallery with thumbnails.
  - "Import to Scene" button streams the GLB asset and invokes `bpy.ops.import_scene.gltf` with proper scaling, origin centering, and auto-focus.
- **Tests:** Headless Blender execution script (`blender --background --python tests/test_addon.py`).
- **Expected Output:** Installable `.zip` add-on package for Blender.
- **Out-of-Scope:** Running generative AI inference locally inside Blender.

---

### Agent F: QA, Security & Hardening
- **Objective:** Audit the codebase for vulnerabilities, enforce file validation, prevent secret leaks, and provide full end-to-end integration test coverage.
- **Scope:** `tests/e2e/**`, `packages/security/**`.
- **Files Owned:** `tests/e2e/**`, security middleware in `apps/api`.
- **Dependencies:** Agents B, C, D, E.
- **Acceptance Criteria:**
  - Automated tests verifying that `TRIPOSR_API_KEY` is not present in client bundles or public responses.
  - Upload security validation (MIME sniffing, file extension vs magic byte check, size cap).
  - Rate-limiting middleware active on generation endpoints.
  - Asset authorization test verifying users cannot access or delete other users' assets.
  - End-to-end flow test (Image Upload -> Mock Job -> Worker Ingestion -> Asset Download).
- **Tests:** Security audit scripts; Playwright E2E tests with mock worker.
- **Expected Output:** Passing E2E test suite and automated security scans.
- **Out-of-Scope:** Modifying business feature logic without prior consensus.

---

### Agent G: Integration, Deployment & Release
- **Objective:** Build Docker Compose local development stacks, production container images, health monitoring, and release documentation.
- **Scope:** `docker-compose.yml`, `Dockerfile.*`, `.env.example`, deployment guides.
- **Files Owned:** `docker-compose.yml`, `docker/**`, release scripts.
- **Dependencies:** All previous agents.
- **Acceptance Criteria:**
  - `docker-compose up` starts PostgreSQL, Redis, MinIO, API server, worker, and Web UI.
  - All services connect cleanly using container network hostnames.
  - Health check scripts verify container liveness and database readiness.
  - Build scripts produce optimized production artifacts.
- **Tests:** Container startup and healthcheck verification script.
- **Expected Output:** One-command local development environment and production-ready images.
- **Out-of-Scope:** Provisioning live cloud accounts.
