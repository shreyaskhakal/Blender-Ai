# Tripo3D Hosted API Integration Specification

**Provider:** Tripo3D ([https://platform.tripo3d.ai](https://platform.tripo3d.ai))  
**API Documentation Reference:** [https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard](https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard)  
**Backend Secret Variable:** `TRIPOSR_API_KEY`  
**Integration Layer:** `packages/tripo3d` (Backend & Worker only)  

---

## 1. Overview & Provider Architecture

Tripo3D provides an asynchronous cloud-based AI service that reconstructs 3D meshes and PBR texture maps from a single 2D image.

> [!IMPORTANT]
> The hosted Tripo3D API is a distinct SaaS offering from the open-source TripoSR model. We interact with Tripo3D over HTTPS using their official REST OpenAPI v3 endpoints. Under no circumstances should client code (browser or Blender) communicate directly with Tripo3D; all requests must flow through the backend API and queue worker.

---

## 2. API Specifications & Endpoints

### 2.1 Base URL & Authentication
* **Base URL:** `https://openapi.tripo3d.ai/v3`
* **Authentication Header:**
  ```http
  Authorization: Bearer <TRIPOSR_API_KEY>
  ```
* **Format:** JSON for generation and task queries; `multipart/form-data` for file uploads.

---

### 2.2 File Upload Endpoint

Before submitting an image for 3D generation, local image binaries are uploaded to Tripo3D to obtain a temporary `file_token`.

* **Endpoint:** `POST https://openapi.tripo3d.ai/v3/files`
* **Content-Type:** `multipart/form-data`
* **Headers:** `Authorization: Bearer <TRIPOSR_API_KEY>`
* **Payload:**
  - `file`: Binary image data (Supported formats: `image/jpeg`, `image/png`).
  - Max file size: **20 MB**.

#### Example Request (`curl`)
```bash
curl -X POST https://openapi.tripo3d.ai/v3/files \
  -H "Authorization: Bearer ${TRIPOSR_API_KEY}" \
  -F "file=@sample_reference.png"
```

#### Response Schema (Success - HTTP 200)
```json
{
  "code": 0,
  "data": {
    "file_token": "file_8f29c011e4d8471bb942b08fa1119"
  }
}
```

---

### 2.3 Image-to-Model Task Submission

* **Endpoint:** `POST https://openapi.tripo3d.ai/v3/generation/image-to-model`
* **Content-Type:** `application/json`
* **Headers:**
  - `Authorization: Bearer <TRIPOSR_API_KEY>`
  - `Content-Type: application/json`

#### Request Payload Parameters

| Field | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `file` | `object` | Yes (or `input`) | — | File descriptor object containing `type: "image"` and `file_token`. |
| `model` | `string` | No | `"v3.1-20260211"` | Model version. Options: flagship `"v3.1-20260211"`, low-poly `"P1-20260311"`. |
| `texture` | `boolean` | No | `true` | Whether to generate diffuse texture maps. |
| `pbr` | `boolean` | No | `true` | Whether to generate roughness, metallic, and normal PBR maps. |
| `texture_quality` | `string` | No | `"standard"` | Quality setting: `"fast"`, `"standard"`, `"detailed"`. |
| `geometry_quality`| `string` | No | `"standard"` | Mesh resolution: `"standard"`, `"detailed"`. |
| `face_limit` | `integer` | No | `null` | Target polygon count (e.g. `10000` to `50000`). |

#### Example Request Payload
```json
{
  "model": "v3.1-20260211",
  "file": {
    "type": "image",
    "file_token": "file_8f29c011e4d8471bb942b08fa1119"
  },
  "texture": true,
  "pbr": true,
  "texture_quality": "standard",
  "geometry_quality": "standard"
}
```

#### Response Schema (Success - HTTP 200)
```json
{
  "code": 0,
  "data": {
    "task_id": "task_2e718bc309a44e99b0c79d1234567890"
  }
}
```

---

### 2.4 Task Status Retrieval & Polling

Because 3D generation is asynchronous and compute-intensive (typically 15 to 90 seconds), the backend worker queries task status on an interval.

* **Endpoint:** `GET https://openapi.tripo3d.ai/v3/tasks/{task_id}`
* **Headers:** `Authorization: Bearer <TRIPOSR_API_KEY>`
* **Polling Cadence:** Recommended interval is **2.0 seconds** with an exponential backoff ceiling of 5.0 seconds.

#### Task State Machine
```
   [Submitted] 
        │
        ▼
    (queued) ──────► (cancelled)
        │
        ▼
    (running) ─────► (failed)
        │
        ▼
    (success)
```

#### Status Enum Values
- `queued`: Task is waiting in Tripo3D GPU cluster queue.
- `running`: AI inference, mesh geometry reconstruction, and UV texture synthesis are in progress.
- `success`: Model generation succeeded; output links are ready.
- `failed`: Generation failed due to an error, invalid geometry, or system exception.
- `cancelled`: Task was cancelled by the user or system.

#### Success Response Schema (HTTP 200)
```json
{
  "code": 0,
  "data": {
    "task_id": "task_2e718bc309a44e99b0c79d1234567890",
    "type": "image_to_model",
    "status": "success",
    "progress": 100,
    "output": {
      "model_url": "https://cdn.tripo3d.ai/tasks/task_2e718b.../model.glb?auth_token=...",
      "rendered_image_url": "https://cdn.tripo3d.ai/tasks/task_2e718b.../render.png?auth_token=..."
    }
  }
}
```

#### Failure Response Schema
```json
{
  "code": 2010,
  "message": "insufficient credit balance",
  "suggestion": "Please recharge your Tripo3D account credits at https://platform.tripo3d.ai"
}
```

---

## 3. Critical Asset Durability & Download Policy

> [!WARNING]
> **5-Minute CDN URL Expiration:** URLs provided in `output.model_url` and `output.rendered_image_url` are signed with a short TTL (~5 minutes). If the application merely saves the Tripo3D CDN URL to the database, client downloads and Blender imports will break after 5 minutes.

### Mandatory Ingestion Workflow
Upon receiving `status: "success"`:
1. **Immediate Stream:** The backend worker opens an HTTP streaming connection to `output.model_url`.
2. **Persistence:** The stream is piped directly into private S3-compatible Object Storage under `assets/{job_id}/model.glb`.
3. **Render Ingestion:** The worker downloads `output.rendered_image_url` to `assets/{job_id}/thumbnail.png`.
4. **Validation:** The worker checks that the GLB file begins with the valid glTF binary magic header (`0x46546C67` / `"glTF"`).
5. **Database Update:** The worker records the durable internal storage key, polygon count, and marks the job status as `completed`.
6. **Client Delivery:** Client requests for asset downloads or 3D viewer rendering receive a freshly generated application pre-signed URL (e.g. 1-hour expiration) referencing private storage.

---

## 4. Rate Limits, Timeouts & Credit Management

- **Rate Limits:** Maximum 10 concurrent generation requests per standard API key tier.
- **Task Timeout:** If a task remains in `queued` or `running` state for more than **180 seconds**, the worker flags it as timed out, records a descriptive error, and halts polling.
- **Credit Consumption:** Each generation costs Tripo3D credits.
- **Credit Exhaustion Handling:** If Tripo returns error code `2010` ("insufficient credit"), the job transitions to `failed` with safe user-facing message: `"AI service credit quota exceeded. Please contact the administrator or check API key quota."`

---

## 5. Local Mock Provider (`Tripo3DMockClient`)

To enable local development, automated unit tests, and CI/CD pipelines without expending paid credits or requiring active internet access:

1. **Config Toggle:** Setting `TRIPO3D_USE_MOCK=true` in `.env` activates `Tripo3DMockClient`.
2. **Mock Behavior:**
   - `uploadFile()` returns a deterministic token: `file_mock_test_token_123`.
   - `createImageToModelTask()` returns a mock task ID: `task_mock_job_456`.
   - `getTaskStatus()` simulates realistic progress:
     - 0s–2s: `queued` (progress 10)
     - 2s–5s: `running` (progress 60)
     - >5s: `success` (progress 100), serving a verified static fixture GLB (`tests/fixtures/cube_sample.glb`).
3. **Safety Guard:** Automated CI tests MUST execute with `TRIPO3D_USE_MOCK=true`. Live API calls are restricted to deliberate smoke tests.

---

## 6. Live API Smoke Test Script

A standalone CLI script (`scripts/tripo-smoke-test.ts`) verifies connectivity against the genuine Tripo3D API:

```bash
# Run manual smoke test with a valid key
export TRIPOSR_API_KEY="your_actual_tripo_key"
pnpm ts-node scripts/tripo-smoke-test.ts --image ./tests/fixtures/sample_chair.png
```

The script:
1. Validates `TRIPOSR_API_KEY` format.
2. Performs `POST /v3/files` and prints `file_token`.
3. Submits `POST /v3/generation/image-to-model` and prints `task_id`.
4. Polls `GET /v3/tasks/{task_id}` every 2 seconds until completion.
5. Downloads the resulting GLB and verifies its binary magic header.
