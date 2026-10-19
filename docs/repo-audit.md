# Repository Audit & Technical Baseline

**Date:** October 19, 2026  
**Auditor:** Principal Software Architect / Antigravity Agent  
**Repository:** [https://github.com/shreyaskhakal/Blender-Ai](https://github.com/shreyaskhakal/Blender-Ai)  
**Local Workspace:** `C:\Users\user5\.gemini\antigravity-ide\scratch\Blender-Ai`  
**Git Branch:** `main` (initial commit pending)  

---

## 1. Executive Summary

A comprehensive repository inspection was conducted on the cloned workspace before creating documentation or code. The repository is a newly initialized, completely empty Git repository containing no branches other than the default `main`, zero commits, and zero source files.

Because there is no legacy code, obsolete configuration, or conflicting technical debt, **Blender AI** begins as a greenfield project. This allows us to establish clean architectural boundaries, modern TypeScript and Python standards, strict typing, automated linting, comprehensive testing, and security-first defaults without backwards-compatibility friction.

---

## 2. Verified Technical Findings vs. Assumptions

| Domain | Verified Finding | Status / Source | Implication |
| :--- | :--- | :--- | :--- |
| **Git & Working Tree** | Branch `main`, 0 commits, clean status | Local Git CLI (`git status`, `git branch -a`) | Clean slate; no uncommitted work to preserve. |
| **Directory Contents** | Contains only `.git/` folder | Filesystem inspection (`list_dir`) | No existing project structure. |
| **Package Manifests** | No `package.json`, `pnpm-lock.yaml`, `requirements.txt`, or `pyproject.toml` | Filesystem search | Dependencies must be specified from scratch. |
| **Frontend Framework** | None present | Filesystem search | Greenfield selection required (Vite + React + Three.js). |
| **Backend Framework** | None present | Filesystem search | Greenfield selection required (Node.js / Fastify or Express with TypeScript). |
| **Database & Schema** | No database configuration, migrations, or ORM schemas present | Filesystem search | Greenfield PostgreSQL schema to be defined. |
| **Object Storage** | None present | Filesystem search | S3-compatible API client needed (AWS S3 / Cloudflare R2 / MinIO for local dev). |
| **Tripo3D Integration** | Not implemented | Filesystem search | Must implement provider adapter per official Tripo3D OpenAPI v3 spec. |
| **Blender Add-on** | No Python add-on files or Blender integration | Filesystem search | Add-on must be written targeting Blender 3.6 LTS and Blender 4.x. |
| **Test Suites** | No test files, test scripts, or test runners | Filesystem search | Test harness (Vitest / Playwright / Pytest) must be established in Stage 1. |
| **CI / CD** | No `.github/workflows` or deployment configs | Filesystem search | GitHub Actions workflows to be created. |

---

## 3. Existing Architecture

* **Current Architecture:** None (0 lines of code).
* **Target Architecture (Approved in ADR-001):** Modular Monolith containing:
  1. **Frontend App (`apps/web`):** React + Vite + TypeScript + Vanilla CSS + Three.js WebGL canvas.
  2. **Backend API (`apps/api`):** Node.js + Fastify/Express + TypeScript REST API (`/api/v1`).
  3. **Background Worker (`packages/worker` or `apps/worker`):** BullMQ + Redis for asynchronous job processing, Tripo3D API polling, and asset persistence.
  4. **Database:** PostgreSQL (managed with Prisma or Kysely for migrations and type safety).
  5. **Object Storage:** S3-compatible storage (MinIO locally, AWS S3 / Cloudflare R2 in production) with pre-signed upload/download URLs.
  6. **Blender Add-on (`blender_addon/blender_ai`):** Python add-on using Blender's `bpy` API for one-click authentication, asset browsing, and direct GLB scene importing.

---

## 4. Existing Implemented Functionality

* **Implemented Features:** None.
* **Working Endpoints:** None.
* **UI Components:** None.
* **Database Models:** None.

---

## 5. Missing Functionality (Gap Analysis)

To deliver the product vision outlined in `PRD.md`, the following functional components must be engineered:
1. **User Upload Pipeline:** Secure client-side image validation (MIME, magic bytes, dimensions, max 20MB) and upload to private object storage.
2. **Provider Adapter (`packages/tripo3d`):** Integration with Tripo3D OpenAPI v3 (`POST /v3/files`, `POST /v3/generation/image-to-model`, `GET /v3/tasks/{task_id}`).
3. **Async Job Orchestration:** Redis + BullMQ task queue to handle long-running 3D generation (10–120 seconds), polling loop, and exponential backoff.
4. **Asset Ingestion & Durability:** Tripo3D model download pipeline that ingests generated `.glb` models from temporary Tripo CDN URLs (5-minute TTL) into durable private storage before marking jobs as complete.
5. **Interactive 3D Preview:** WebGL canvas using Three.js with OrbitControls, PBR material rendering, environment lighting, wireframe toggling, and polygon inspection.
6. **Blender Python Add-on:** Add-on panel inside Blender 3D Viewport (`N-panel`) supporting user API token configuration, asset library sync, and seamless import into the active 3D scene.
7. **Security & Data Isolation:** Role-based access control, user ownership checks, signed temporary URLs for asset downloads, and secret isolation (ensuring `TRIPOSR_API_KEY` is never leaked to client runtimes).

---

## 6. Existing Tests and How to Run Them

* **Current Tests:** None.
* **Commands Tested:** None available.
* **Target Test Harness (Specified in `TESTING.md`):**
  - Unit & Integration: `pnpm test` (Vitest for frontend/backend).
  - Provider Mock: Deterministic Tripo3D fixture adapter to run test suites without consuming live API credits.
  - Python / Add-on: `pytest` with Blender headless runner (`blender --background --python ...`).

---

## 7. Tripo3D Integration Status & Findings

* **Current State:** No API client or tokens configured.
* **Verified Provider Specifications (Official Tripo3D OpenAPI v3):**
  - **Base URL:** `https://openapi.tripo3d.ai/v3`
  - **Authentication:** `Authorization: Bearer <TRIPOSR_API_KEY>` (Backend environment variable).
  - **File Upload:** `POST /v3/files` (multipart/form-data, accepts JPEG/PNG up to 20MB, returns `file_token`).
  - **Generation Endpoint:** `POST /v3/generation/image-to-model` (accepts `file`, `model`, `texture`, `pbr`, `texture_quality`, `face_limit`).
  - **Task Polling:** `GET /v3/tasks/{task_id}` (returns status: `queued`, `running`, `success`, `failed`, `cancelled`).
  - **CDN Lifespan Alert:** Generated output URLs (`output.model_url`) expire in approximately **5 minutes**. The backend worker **must** stream and persist the GLB file immediately upon completion.
  - **Credit Consumption:** Live requests consume paid provider credits. Mock adapters are strictly required for CI and unit test execution.

---

## 8. Compatibility Constraints

* **Node.js:** Node.js `>= 20.x LTS` and `pnpm >= 9.x` (or `npm`).
* **Python:** Python `3.10` or `3.11` (compatible with Blender's bundled Python environment).
* **Blender:** Blender `3.6 LTS` and Blender `4.x` (Python `bpy` API, `bpy.ops.import_scene.gltf`).
* **Browser Runtime:** Modern browsers with WebGL 2.0 support (Chrome, Firefox, Safari, Edge).
* **Operating Systems:** Windows 10/11, macOS (Apple Silicon / Intel), Linux (Ubuntu 22.04+).

---

## 9. Risks and Recommended Next Steps

### Critical Risks
1. **Unintentional API Credit Depletion:** Running integration tests against the live Tripo3D endpoint will consume real developer credits.  
   *Mitigation:* Create a strict mock adapter (`Tripo3DMockProvider`) enabled by default in local test environments.
2. **CDN URL Expiration:** If the worker merely stores Tripo3D's output URL instead of the binary asset, user downloads will fail after 5 minutes.  
   *Mitigation:* Mandatory automated streaming of the GLB asset to private object storage as part of job finalization.
3. **Secret Leakage:** If the frontend makes direct requests to Tripo3D, `TRIPOSR_API_KEY` would be exposed in browser network inspection.  
   *Mitigation:* All Tripo3D interactions are isolated strictly to the backend API and worker.

### Immediate Next Steps
1. Establish the full documentation suite (`PRD.md`, `ARCHITECTURE.md`, `design.md`, `schema.md`, `API.md`, etc.).
2. Commit the documentation foundation to Git on `main`.
3. Obtain user approval to begin Stage 1 (scaffolding monorepo, Docker Compose, DB migrations, and provider mock).
