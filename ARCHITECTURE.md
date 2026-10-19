# System Architecture & Technical Design

**Document Version:** 1.0.0  
**Status:** Approved Architecture Baseline  
**Lead Architect:** Principal Software Architect  

---

## 1. Architecture Overview

### 1.1 Verified Current Architecture
* **Current State:** Greenfield baseline (0 lines of code, newly initialized Git repository).
* **Reference Baseline:** Documented in [docs/repo-audit.md](file:///C:/Users/user5/.gemini/antigravity-ide/scratch/Blender-Ai/docs/repo-audit.md).

### 1.2 Target Architecture: Modular Monolith with Asynchronous Queue Worker
To satisfy the requirements of long-running 3D generative inference (15–120 seconds), strict secret isolation (`TRIPOSR_API_KEY`), durable storage before CDN expiration, and seamless Blender integration without unnecessary microservice complexity, Blender AI is engineered as a **Modular Monolith with an Asynchronous Job Worker**.

---

## 2. System Context Diagram (C4 Level 1)

```mermaid
C4Context
    title System Context Diagram — Blender AI Platform

    Person(user, "Creator / 3D Artist", "Uploads reference images, inspects 3D models, and imports assets into Blender.")
    
    System(blender_ai, "Blender AI Platform", "Web application, REST API, background worker, and asset storage system.")
    System_Ext(tripo3d, "Tripo3D Hosted Cloud API", "External cloud AI service generating 3D meshes and textures from 2D images.")
    System_Ext(blender, "Blender Desktop DCC", "Desktop 3D creation software with native Blender AI Python add-on installed.")

    Rel(user, blender_ai, "Uploads images, reviews 3D models, triggers generations via Web UI (HTTPS)")
    Rel(blender_ai, tripo3d, "Submits tasks and polls generation progress (HTTPS OpenAPI v3)")
    Rel(blender, blender_ai, "Fetches asset library and downloads GLB models via REST API (HTTPS)")
    Rel(user, blender, "Operates 3D Viewport and scenes")
```

---

## 3. Container & Component Architecture (C4 Level 2)

```mermaid
graph TD
    subgraph ClientLayer ["Client Layer"]
        WebUI["Web Application (React + Vite + Three.js)"]
        BlenderAddon["Blender Python Add-on (bpy + Requests)"]
    end

    subgraph EdgeLayer ["Edge / Ingress Layer"]
        ReverseProxy["Reverse Proxy / Nginx / Caddy"]
    end

    subgraph ApplicationLayer ["Core Application Backend"]
        APIServer["REST API Server (Node.js + Fastify / TypeScript)"]
        BullMQWorker["Background Worker (Node.js + BullMQ)"]
        TripoAdapter["Tripo3D Provider Adapter (packages/tripo3d)"]
    end

    subgraph DataStorageLayer ["Data & Storage Layer"]
        PostgresDB[(PostgreSQL Database)]
        RedisQueue[(Redis Cache & BullMQ)]
        ObjectStorage[(S3-Compatible Storage: MinIO / AWS S3)]
    end

    subgraph ExternalProvider ["External Provider"]
        TripoAPI["Tripo3D OpenAPI v3 Cloud Service"]
    end

    WebUI -->|HTTPS / WSS| ReverseProxy
    BlenderAddon -->|HTTPS / API Token| ReverseProxy
    ReverseProxy -->|Proxy Pass| APIServer

    APIServer -->|Read / Write State| PostgresDB
    APIServer -->|Enqueue Tasks| RedisQueue
    APIServer -->|Pre-signed URLs / Streaming| ObjectStorage

    BullMQWorker -->|Dequeue Jobs| RedisQueue
    BullMQWorker -->|Update Status & Assets| PostgresDB
    BullMQWorker -->|Persist GLB & Thumbnail| ObjectStorage
    BullMQWorker -->|Delegate API Calls| TripoAdapter

    TripoAdapter -->|HTTPS / Bearer Secret| TripoAPI
```

---

## 4. Why Asynchronous Background Processing is Mandatory

In modern web development, HTTP requests through reverse proxies, load balancers, and browser network stacks have strict connection timeouts (typically 15 to 30 seconds). 

AI 3D mesh reconstruction takes between **15 and 120 seconds**, occasionally longer when provider GPU nodes are scaling. If the web client were to trigger generation synchronously via a single HTTP request:
1. **Network Timeouts:** Reverse proxies would drop the connection with an HTTP 504 Gateway Timeout.
2. **Client Fragility:** If the user refreshed or closed their browser tab, the execution context would terminate, orphaning the cloud generation and wasting paid API credits.
3. **CDN Link Expiration:** Tripo3D's output CDN links expire in approximately **5 minutes**. If the client receives a link directly and does not download it immediately, the asset is lost forever.

**Solution:** The backend API immediately writes a job to PostgreSQL in `queued` status and enqueues a lightweight message into Redis BullMQ (< 50ms response). The client receives an HTTP 202 Accepted with a `job_id`. The dedicated worker manages the polling loop and downloads the output GLB directly into durable private storage before marking the job `completed`.

---

## 5. End-to-End Sequence Diagrams

### 5.1 Image Upload & Job Enqueuing Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Browser
    participant API as API Server (apps/api)
    participant Storage as Private Object Storage
    participant DB as PostgreSQL
    participant Queue as Redis (BullMQ)

    User->>API: POST /api/v1/uploads (Image metadata & MIME)
    API->>API: Validate file type, magic bytes & size (<= 20MB)
    API->>Storage: Generate Pre-signed Upload URL
    API-->>User: HTTP 200 OK (upload_url, upload_id)
    User->>Storage: PUT binary image stream (Direct Upload)
    Storage-->>User: HTTP 200 OK (Upload Complete)
    
    User->>API: POST /api/v1/generation-jobs {upload_id, model, pbr}
    API->>DB: INSERT INTO generation_jobs (status='queued')
    API->>Queue: Enqueue 'generate-3d' job {job_id}
    API-->>User: HTTP 202 Accepted {job_id, status: 'queued'}
```

---

### 5.2 Background Worker & Tripo3D Generation Flow

```mermaid
sequenceDiagram
    autonumber
    participant Queue as Redis (BullMQ)
    participant Worker as Background Worker (apps/worker)
    participant DB as PostgreSQL
    participant Storage as Private Object Storage
    participant Tripo as Tripo3D Cloud API

    Queue->>Worker: Dispatch 'generate-3d' job {job_id}
    Worker->>DB: UPDATE generation_jobs SET status='processing'
    Worker->>Storage: Fetch uploaded reference image stream
    Worker->>Tripo: POST /v3/files (Multipart upload)
    Tripo-->>Worker: HTTP 200 {file_token}
    
    Worker->>Tripo: POST /v3/generation/image-to-model {file_token}
    Tripo-->>Worker: HTTP 200 {task_id}
    Worker->>DB: UPDATE generation_jobs SET provider_task_id=task_id

    loop Every 2.0s until complete or 180s timeout
        Worker->>Tripo: GET /v3/tasks/{task_id}
        Tripo-->>Worker: HTTP 200 {status: 'running', progress: 65}
        Worker->>DB: UPDATE generation_jobs SET progress=65
    end

    Note over Tripo,Worker: Status changes to 'success' with output CDN URLs
    Worker->>Tripo: GET output.model_url (Stream GLB binary)
    Worker->>Storage: PUT assets/{job_id}/model.glb (Durable storage)
    Worker->>Tripo: GET output.rendered_image_url (Stream thumbnail)
    Worker->>Storage: PUT assets/{job_id}/thumbnail.png
    
    Worker->>DB: INSERT INTO assets (...)
    Worker->>DB: UPDATE generation_jobs SET status='completed', progress=100
    Worker-->>Queue: Acknowledge job completion
```

---

### 5.3 Asset Download & Blender Add-on Import Flow

```mermaid
sequenceDiagram
    autonumber
    actor Artist as 3D Artist
    participant Blender as Blender Add-on (bpy)
    participant API as API Server (apps/api)
    participant DB as PostgreSQL
    participant Storage as Private Object Storage

    Artist->>Blender: Open 3D Viewport -> Sidebar "Blender AI"
    Blender->>API: GET /api/v1/assets (Bearer user_api_token)
    API->>DB: Query user's completed assets
    DB-->>API: Return asset records
    API-->>Blender: JSON [ {id, name, thumbnail_url, polycount} ]
    Blender-->>Artist: Render asset thumbnail gallery in N-panel

    Artist->>Blender: Click "Import into Scene" on Asset #42
    Blender->>API: GET /api/v1/assets/42/download
    API->>Storage: Generate Pre-signed Download URL (15-min TTL)
    API-->>Blender: HTTP 200 {download_url}
    
    Blender->>Storage: GET /assets/.../model.glb
    Storage-->>Blender: Stream binary GLB data
    Blender->>Blender: Save temporary local file (.glb)
    Blender->>Blender: bpy.ops.import_scene.gltf(filepath=...)
    Blender->>Blender: Auto-center origin, snap to Z=0, frame viewport
    Blender-->>Artist: 3D model appears in scene with PBR materials
```

---

### 5.4 Failure & Retry Sequence

```mermaid
sequenceDiagram
    autonumber
    participant Worker as Background Worker
    participant Tripo as Tripo3D API
    participant DB as PostgreSQL

    Worker->>Tripo: GET /v3/tasks/{task_id}
    alt Network Glitch / 5xx Gateway Error
        Tripo-->>Worker: HTTP 502 Bad Gateway
        Worker->>Worker: Exponential backoff delay (2s -> 4s -> 8s)
        Worker->>Tripo: Retry GET /v3/tasks/{task_id}
    else Task Fails at Provider (Invalid Geometry / Bad Input)
        Tripo-->>Worker: HTTP 200 {status: 'failed', code: 3001, message: 'mesh generation failed'}
        Worker->>DB: UPDATE generation_jobs SET status='failed', error_message='Mesh generation failed on provider.', error_code='PROVIDER_ERROR'
    else Credit Exhausted
        Tripo-->>Worker: HTTP 200 {status: 'failed', code: 2010, message: 'insufficient credits'}
        Worker->>DB: UPDATE generation_jobs SET status='failed', error_message='Provider credit quota reached.', error_code='CREDIT_EXHAUSTED'
    else Timeout Exceeded (180 seconds)
        Worker->>DB: UPDATE generation_jobs SET status='failed', error_message='Generation timed out after 180s.', error_code='TIMEOUT'
    end
```

---

## 6. Trust Boundaries & Security Architecture

1. **Public Internet -> API Gateway (Trust Boundary 1):**
   - TLS 1.3 encryption.
   - Strict CORS policy limiting requests to the web application domain.
   - Rate limiting on generation endpoints.
2. **API Server -> Database & Redis (Trust Boundary 2 - Internal Network):**
   - Database credentials managed via private environment variables.
   - Object storage access uses IAM roles or dedicated private S3 credentials.
3. **Backend Worker -> Tripo3D API (Trust Boundary 3 - External Egress):**
   - Egress secured with HTTPS.
   - `TRIPOSR_API_KEY` is loaded strictly in server-side process environments and never transmitted to clients.
4. **API Server -> Blender Add-on (Trust Boundary 4):**
   - Authenticated via personal user API tokens (UUIDv4 / Bearer tokens).
   - Scoped strictly to asset read and download permissions.

---

## 7. Component Responsibilities & Technology Stack

| Component | Technology | Primary Responsibilities |
| :--- | :--- | :--- |
| **Frontend Web** | React 18, Vite, TypeScript, Vanilla CSS | UI/UX, image dropzone, WebGL 3D preview canvas, job polling, responsive layouts. |
| **3D Canvas** | Three.js, OrbitControls, GLTFLoader | Real-time WebGL rendering, PBR material evaluation, wireframe toggle, camera controls. |
| **Backend API** | Node.js (v20 LTS), Fastify / TypeScript | REST endpoints (`/api/v1`), upload validation, authentication, job orchestration. |
| **Queue Worker** | BullMQ, Redis (v7) | Background execution, Tripo3D polling, asset streaming from CDN to storage. |
| **Provider Adapter** | `packages/tripo3d` (TypeScript) | Isolates Tripo3D OpenAPI v3 calls, provides mock fixtures for automated tests. |
| **Relational DB** | PostgreSQL 16 | Relational data persistence: `users`, `generation_jobs`, `assets`, `asset_events`. |
| **Object Storage** | MinIO (Dev) / AWS S3 or Cloudflare R2 (Prod) | Secure binary storage for uploaded input images, generated `.glb` models, and thumbnails. |
| **Blender Add-on** | Python 3.10+, Blender `bpy` API | In-viewport N-panel UI, asset browsing, automatic glTF scene importing. |

---

## 8. Scaling Strategy & Architectural Limits

- **Horizontal API Scaling:** The Fastify API server is stateless; multiple instances can sit behind a load balancer.
- **Worker Concurrency:** BullMQ worker instances scale horizontally based on Redis queue depth (`generate-3d` job count).
- **Storage Scalability:** S3-compatible storage scales elastically without application intervention.
- **Tripo3D Quota Limit:** System throughput is bounded by the Tripo3D account concurrency tier (default: 10 concurrent generation tasks). BullMQ's rate-limiter ensures requests stay within provider allowances.
