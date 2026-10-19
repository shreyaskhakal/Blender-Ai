# Testing Strategy & Quality Assurance Plan

**Document Version:** 1.0.0  
**Status:** Approved QA Strategy  
**QA Lead:** Principal Security & QA Engineer  

---

## 1. Testing Philosophy & Credit Protection Rule

> [!CAUTION]
> **Strict Credit Protection:** Automated tests, pull request checks, and local test runners must NEVER make live requests to Tripo3D or consume paid API credits. All test harnesses must configure `TRIPO3D_USE_MOCK=true`. Live provider tests are strictly restricted to isolated, manually triggered smoke scripts (`scripts/tripo-smoke-test.ts`).

---

## 2. Test Pyramid & Scope

```
                ┌─────────────────────────┐
                │   End-to-End Tests      │  Playwright (Upload -> Mock 3D render)
                ├─────────────────────────┤
                │   Integration Tests     │  API routes, DB migrations, BullMQ
                ├─────────────────────────┤
                │   Blender Add-on Tests  │  Headless Blender (bpy) import
                ├─────────────────────────┤
                │   Unit & Contract Tests │  Vitest, Pytest, Magic byte validator
                └─────────────────────────┘
```

| Layer | Tools | Scope | Credit Usage |
| :--- | :--- | :--- | :--- |
| **Unit Tests** | Vitest, Pytest | Pure functions, MIME validation, schema parsers | Zero (Offline) |
| **Provider Mock Tests** | Vitest + MSW / MockClient | Tripo3D adapter status transitions, error handling | Zero (Mocked) |
| **API Integration** | Supertest, Vitest | Fastify routes, database transactions, auth | Zero (Local DB) |
| **Worker Queue Tests** | BullMQ Test Harness | Job enqueuing, polling loop, backoff, CDN ingest | Zero (Mock CDN) |
| **Blender Add-on** | Headless Blender 3.6/4.x | Add-on registration, UI panel, GLB import | Zero (Offline) |
| **E2E Browser Tests** | Playwright | Full user journey in browser | Zero (Mocked) |
| **Live Smoke Test** | Node CLI Script | Verified connection to genuine Tripo3D API | **Consumes 1 Credit** |

---

## 3. Test Suites & Specifications

### 3.1 Unit & Contract Tests
- **Upload Validation Tests (`packages/storage`):**
  - Verify that valid PNG files pass magic-byte verification.
  - Verify that renamed `.exe` or `.txt` files with `.png` extensions fail immediately.
  - Verify rejection of files exceeding 20 MB.
- **Tripo3D Adapter Tests (`packages/tripo3d`):**
  - Verify serialization of parameters (`model`, `pbr`, `texture`, `texture_quality`).
  - Verify parsing of Tripo3D error payloads (e.g. code `2010` -> `CREDIT_EXHAUSTED`).

### 3.2 Background Worker & Retry Tests (`apps/worker`)
- **Polling Loop:** Simulate 3 polling cycles (`queued` -> `running` -> `success`) verifying database updates at each step.
- **CDN Ingestion Test:** Verify that when Tripo3D returns a temporary CDN URL, the worker streams the file directly to private S3 and verifies glTF binary headers.
- **Timeout Test:** Verify that jobs running past 180 seconds transition to `failed` with code `TIMEOUT`.

### 3.3 Authorization & Ownership Tests (`apps/api`)
- Verify that User B cannot download an asset owned by User A (HTTP 403 Forbidden).
- Verify that unauthenticated requests to `/api/v1/generation-jobs` return HTTP 401 Unauthorized.
- Verify that invalid API tokens return HTTP 401.

### 3.4 Blender Add-on Headless Tests (`blender_addon`)
Run inside Blender's embedded Python runtime:
```bash
blender --background --factory-startup --python tests/blender/test_addon_registration.py
```
- Validates add-on metadata and successful registration in `bpy.utils`.
- Validates `bpy.ops.blender_ai.import_model` using a static local `.glb` fixture.
- Confirms object position, scale normalization, and active selection.

---

## 4. Test Execution Commands (Stage 1+)

```bash
# Run all unit and integration tests across monorepo (Offline)
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run end-to-end browser tests
pnpm test:e2e

# Run Blender add-on headless tests
pnpm test:blender

# Deliberate, manual live smoke test (Requires paid key)
export TRIPOSR_API_KEY="actual_secret_key"
pnpm ts-node scripts/tripo-smoke-test.ts --image ./tests/fixtures/sample_chair.png
```

---

## 5. Current Baseline Test Verification Status

As established in [docs/repo-audit.md](file:///C:/Users/user5/.gemini/antigravity-ide/scratch/Blender-Ai/docs/repo-audit.md), the repository is currently in **Stage 0 (Documentation Baseline)**.

| Test Category | Status in Stage 0 | Target in Stage 1 |
| :--- | :--- | :--- |
| **Unit Tests** | None (Greenfield) | 100% pass on core utilities |
| **API Integration** | None (Greenfield) | Healthcheck & auth routes passing |
| **Provider Mock** | None (Greenfield) | Deterministic mock fixture passing |
| **Blender Add-on** | None (Greenfield) | Headless registration passing |
| **Live Smoke Test** | Blocked (Awaiting Stage 1) | Manual verification pass |
