# Blender AI REST API Specification (`/api/v1`)

**Document Version:** 1.0.0  
**Base URL:** `https://api.blender-ai.local/api/v1` (Dev) / `https://api.blender-ai.app/api/v1` (Prod)  
**Status:** **[PLANNED]** (All routes specified as contractual baselines for Stage 1 implementation)  
**Authentication Scheme:** HTTP Bearer Tokens (`Authorization: Bearer <token>`)  

---

## 1. Authentication & Security Headers

All requests except `/health` and public auth routes require an `Authorization` header:
```http
Authorization: Bearer <session_jwt_or_user_api_token>
```
* **Web UI Session:** Uses signed JWTs stored in HTTP-only cookies or Bearer headers.
* **Blender Add-on:** Uses personal API tokens prefixed with `bai_` (e.g., `bai_f7d8c91a0b2c3d4e5f6a7b8c9d0e1f2a`).

### Common Response Headers
```http
Content-Type: application/json
X-Request-Id: 7e2b10cd-4e89-498b-90f1-0987654321ab
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1697728800
```

---

## 2. API Endpoint Directory

| Method | Endpoint | Description | Auth Required | Status |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Health check for API, DB & Redis | No | Planned |
| `POST` | `/uploads` | Initiate pre-signed direct image upload | Yes | Planned |
| `POST` | `/uploads/:id/complete` | Confirm upload & validate magic bytes | Yes | Planned |
| `POST` | `/generation-jobs` | Enqueue a new 3D generation job | Yes | Planned |
| `GET` | `/generation-jobs` | List user generation jobs (history) | Yes | Planned |
| `GET` | `/generation-jobs/:id` | Poll status and progress of a job | Yes | Planned |
| `POST` | `/generation-jobs/:id/cancel`| Cancel queued generation job | Yes | Planned |
| `GET` | `/assets` | List user's completed 3D assets | Yes | Planned |
| `GET` | `/assets/:id` | Retrieve 3D asset metadata | Yes | Planned |
| `GET` | `/assets/:id/download` | Get temporary pre-signed download URL | Yes | Planned |
| `DELETE`| `/assets/:id` | Soft-delete a 3D asset | Yes | Planned |

---

## 3. Detailed Endpoint Contracts

### 3.1 Health Check
`GET /api/v1/health`

#### Response (200 OK)
```json
{
  "status": "healthy",
  "timestamp": "2026-10-19T19:00:00Z",
  "version": "0.1.0",
  "dependencies": {
    "database": "connected",
    "redis": "connected",
    "storage": "connected"
  }
}
```

---

### 3.2 Create Image Upload Session
`POST /api/v1/uploads`

Requests permission and a pre-signed S3 URL to upload an input reference image directly to private object storage.

#### Request Body
```json
{
  "file_name": "concept_chair.png",
  "mime_type": "image/png",
  "file_size_bytes": 2451020
}
```

#### Response (201 Created)
```json
{
  "upload_id": "upl_8f91a0c21b",
  "storage_key": "uploads/a0eebc99/upl_8f91a0c21b.png",
  "upload_url": "https://storage.blender-ai.local/uploads/upl_8f91a0c21b.png?X-Amz-Signature=...",
  "expires_in_seconds": 900
}
```

---

### 3.3 Confirm Upload & Validate
`POST /api/v1/uploads/:id/complete`

Notifies the API that the binary upload is finished. The API reads the initial bytes of the file from storage to verify magic headers (`image/png` or `image/jpeg`).

#### Response (200 OK)
```json
{
  "upload_id": "upl_8f91a0c21b",
  "status": "validated",
  "dimensions": {
    "width": 1024,
    "height": 1024
  }
}
```

---

### 3.4 Create Generation Job
`POST /api/v1/generation-jobs`

Enqueues an asynchronous generation job. Requires an `Idempotency-Key` header to prevent double-charging on network retries.

#### Headers
```http
Idempotency-Key: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d
```

#### Request Body
```json
{
  "upload_id": "upl_8f91a0c21b",
  "model": "v3.1-20260211",
  "texture": true,
  "pbr": true,
  "texture_quality": "standard",
  "face_limit": 50000
}
```

#### Response (202 Accepted)
```json
{
  "job_id": "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22",
  "status": "queued",
  "progress": 0,
  "created_at": "2026-10-19T19:05:00Z"
}
```

---

### 3.5 Poll Generation Job Status
`GET /api/v1/generation-jobs/:id`

Polled by the frontend application every 2 seconds during active generation.

#### Response (In Progress - 200 OK)
```json
{
  "job_id": "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22",
  "status": "processing",
  "progress": 65,
  "provider": "tripo3d",
  "error": null,
  "asset_id": null
}
```

#### Response (Completed - 200 OK)
```json
{
  "job_id": "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22",
  "status": "completed",
  "progress": 100,
  "provider": "tripo3d",
  "error": null,
  "asset_id": "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c33"
}
```

#### Response (Failed - 200 OK)
```json
{
  "job_id": "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22",
  "status": "failed",
  "progress": 40,
  "provider": "tripo3d",
  "error": {
    "code": "PROVIDER_ERROR",
    "message": "AI service could not extract geometry from input image."
  },
  "asset_id": null
}
```

---

### 3.6 List Completed Assets
`GET /api/v1/assets?page=1&limit=20`

Used by both the web asset gallery and the Blender Python add-on.

#### Response (200 OK)
```json
{
  "data": [
    {
      "id": "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c33",
      "name": "Wooden Chair Concept",
      "format": "glb",
      "file_size_bytes": 4812940,
      "triangle_count": 32410,
      "vertex_count": 16802,
      "has_pbr_textures": true,
      "thumbnail_url": "https://storage.blender-ai.local/assets/c2eebc99/thumbnail.png?sig=...",
      "created_at": "2026-10-19T19:06:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_records": 1,
    "total_pages": 1
  }
}
```

---

### 3.7 Get Authorized Asset Download URL
`GET /api/v1/assets/:id/download`

Generates an authenticated, short-lived signed URL for downloading the binary `.glb` model.

#### Response (200 OK)
```json
{
  "asset_id": "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c33",
  "format": "glb",
  "file_name": "wooden_chair_concept.glb",
  "download_url": "https://storage.blender-ai.local/assets/c2eebc99/model.glb?X-Amz-Signature=...",
  "expires_in_seconds": 900
}
```

---

## 4. Standard Error Codes & Envelope

All API errors return standard RFC-7807 formatted JSON:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The uploaded file format is not supported.",
    "details": [
      {
        "field": "mime_type",
        "issue": "Must be image/png or image/jpeg"
      }
    ]
  }
}
```

### Common Error Codes
- `UNAUTHORIZED` (401): Missing, malformed, or expired Bearer token.
- `FORBIDDEN` (403): User attempted to access an asset owned by another user.
- `NOT_FOUND` (404): Job or asset ID does not exist.
- `RATE_LIMIT_EXCEEDED` (429): Exceeded maximum generation submission rate.
- `CREDIT_EXHAUSTED` (503): Tripo3D credit quota exhausted.
