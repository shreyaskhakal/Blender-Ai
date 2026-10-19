# Product Requirements Document (PRD) — Blender AI

**Document Version:** 1.0.0  
**Target Release:** MVP (v0.1.0)  
**Status:** Approved  
**Author:** Principal Software Architect & Product Manager  

---

## 1. Executive Summary

**Blender AI** is an open-source productivity platform and creator tool that transforms 2D reference images into genuine, high-quality 3D assets (`.glb` / glTF format) ready for immediate use in 3D workflows. By combining an intuitive web application, an asynchronous cloud processing pipeline powered by Tripo3D's hosted API, an interactive in-browser WebGL 3D preview, and a native Blender Python add-on, Blender AI removes the technical friction of 3D asset generation for indie game developers, concept artists, hobbyists, and digital creators.

---

## 2. Product Vision & Mission

* **Vision:** Democratize 3D modeling by bridging modern generative AI with industry-standard digital content creation (DCC) pipelines.
* **Mission:** Empower creators to turn visual concepts into usable 3D meshes in seconds, with seamless one-click importing directly into Blender.

---

## 3. Problem Statement & User Pain Points

Creating 3D models from scratch is one of the most time-consuming bottlenecks in modern game development, VFX, and digital art:
1. **High Barrier to Entry:** Beginners face a steep learning curve mastering box modeling, sculpting, UV unwrapping, and PBR texturing.
2. **Rapid Prototyping Drag:** Experienced artists and game developers spend hours blocking out background props and concept assets rather than refining hero elements.
3. **Fragmented AI Workflows:** Existing 3D AI tools often require external cloud dashboards, manual downloads, format conversions, scale adjustments, and tedious re-importing into Blender.
4. **Fragile Ephemeral Links:** Many cloud generation APIs provide temporary download links that expire after minutes, causing lost work if not immediately downloaded.

---

## 4. Target Users & Personas

### Persona A: "Indie Game Developer Alex"
- **Profile:** Solo game dev building a 3D exploration title in Godot/Unity/Unreal.
- **Needs:** Fast turnaround for secondary environment props (furniture, crates, rocks, signage).
- **Pain Point:** Cannot afford hiring dedicated 3D prop artists for every background item.

### Persona B: "Concept Artist & 3D Generalist Maya"
- **Profile:** Digital illustrator transitioning into 3D concept blockouts using Blender.
- **Needs:** Immediate 3D geometry from 2D sketches to establish camera perspective, shadows, and scene scale.
- **Pain Point:** Frustrated by switching between web browsers, file directories, and manual glTF import dialogues.

---

## 5. Product Goals & Non-Goals

### Product Goals
- Provide an intuitive web dashboard where users upload a reference image and receive an interactive 3D preview within 30–90 seconds.
- Permanently archive generated models in durable private storage with instant re-download capabilities.
- Provide a native Blender Python add-on that connects to the user's account and imports generated models directly into the active Blender scene with correct scale and origin.
- Deliver a robust asynchronous backend resilient to provider delays, network drops, and API timeouts.

### Non-Goals
- **Replacing 3D Artists:** Blender AI does not aim to replace detailed character rigging, complex hero sculpts, or high-end mechanical CAD modeling.
- **Local GPU Inference in Browser/Blender:** The MVP relies on the hosted Tripo3D cloud API; local hardware is not burdened with running multi-gigabyte neural networks.
- **Full In-Browser 3D Modeling Suite:** Blender AI provides viewing, wireframe inspection, and transformation presets, but is not a browser-based DCC editor. Full mesh editing belongs in Blender.

> [!NOTE]
> **Nature of Single-Image 3D Reconstruction:** A single 2D image contains only partial geometric information. The AI model must synthesize unseen rear and occluded geometry through statistical inference. The quality and topological cleanliness of the output mesh depend directly on lighting clarity, silhouette distinction, and provider AI capabilities. Users must understand that AI outputs serve as high-quality baselines and prototyping assets, often requiring topology retopology for hero animation.

---

## 6. MVP vs. Future Product Scope

| Capability | In Scope for MVP (v0.1) | Future Roadmap (v0.2+) |
| :--- | :--- | :--- |
| **Input Modality** | Single 2D image (JPEG/PNG up to 20MB) | Multi-view images, text-to-3D, sketch-to-3D |
| **AI Provider** | Tripo3D Hosted Cloud API (v3) | Additional providers (Meshy, local TripoSR fallback) |
| **Generation Queue** | Asynchronous Redis + BullMQ worker | Distributed autoscaling worker cluster |
| **Asset Formats** | Textured binary glTF (`.glb`) | `.obj`, `.fbx`, `.usdz`, separate PBR map exports |
| **Viewer** | WebGL Three.js canvas (Orbit, lighting, wireframe) | Material editor, polycount decimation slider |
| **Blender Integration** | Python Add-on for 3D Viewport (N-panel import) | Automated Auto-Rigging, texture baking nodes |
| **Auth & Isolation** | Session/API token authentication & user ownership | Team workspaces, public asset sharing community |

---

## 7. Functional Requirements

### 7.1 Image Upload & Validation
- **FR-001 (Upload Intake):** The system must accept user-provided reference images via drag-and-drop or file selector.
  - *Priority:* P0 (Must-Have)
  - *Acceptance Criteria:* Supports PNG and JPEG up to 20 MB. Displays immediate client-side preview with dimensions and file size.
  - *Error Handling:* Rejects non-image files, unsupported MIME types, and files exceeding 20 MB with clear error messages.
- **FR-002 (Secure Storage):** Uploaded reference images must be stored in private object storage before generation.
  - *Priority:* P0
  - *Acceptance Criteria:* Client uploads directly via pre-signed URL or streamed through backend validation. Asset key linked to user.

### 7.2 Generation Job Orchestration
- **FR-003 (Task Enqueuing):** The system must create an asynchronous generation job upon user request and return immediately with HTTP 202 Accepted.
  - *Priority:* P0
  - *Acceptance Criteria:* Job created in database in `queued` state; background task enqueued in Redis BullMQ.
- **FR-004 (Tripo3D Task Management):** The background worker must communicate with Tripo3D API to upload the file, trigger generation, and poll task status.
  - *Priority:* P0
  - *Acceptance Criteria:* Implements official OpenAPI v3 specifications. Polls every 2s until `success`, `failed`, or 180s timeout.
- **FR-005 (Job State Tracking):** The system must maintain accurate, durable job states: `queued`, `processing`, `completed`, `failed`, `cancelled`.
  - *Priority:* P0
  - *Acceptance Criteria:* Status queries via `/api/v1/generation-jobs/:id` accurately reflect active state and percentage progress (0–100%).

### 7.3 Asset Persistence & Durability
- **FR-006 (CDN Ingestion):** The worker must stream generated `.glb` models from Tripo3D's temporary CDN URLs into private storage immediately upon completion.
  - *Priority:* P0 (Critical Durability)
  - *Acceptance Criteria:* Ingestion must complete before the job status transitions to `completed`. Mitigates Tripo's 5-minute CDN expiration.
- **FR-007 (Asset Record Creation):** A permanent `assets` record must be created linking the input image, output `.glb`, rendered thumbnail, and polycount metadata.
  - *Priority:* P0

### 7.4 Interactive 3D Web Preview
- **FR-008 (Three.js WebGL Viewer):** The web application must display an interactive 3D viewport for completed assets.
  - *Priority:* P0
  - *Acceptance Criteria:* Smooth 60 FPS OrbitControls (rotate, pan, zoom). Supports PBR environment lighting, grid floor toggle, and wireframe toggle.
- **FR-009 (Model Metadata Display):** The viewer must display face count, vertex count, file size, and creation timestamp.
  - *Priority:* P1

### 7.5 Asset Library & Downloads
- **FR-010 (Asset Gallery):** Users must be able to view a paginated grid of their previous generations with thumbnails and statuses.
  - *Priority:* P1
  - *Acceptance Criteria:* Displays thumbnail, job status, timestamp, and quick-action buttons (View, Download, Delete).
- **FR-011 (Secure Download):** Users must be able to download the `.glb` model file via a temporary signed URL.
  - *Priority:* P0
- **FR-012 (Asset Deletion):** Users must be able to soft-delete or permanently delete their generated assets and associated storage files.
  - *Priority:* P1

### 7.6 Blender Add-on Integration
- **FR-013 (Add-on UI & Preferences):** The Blender add-on must provide an N-panel in the 3D Viewport with an API Key preference setting.
  - *Priority:* P0
  - *Acceptance Criteria:* Users enter their personal Blender AI API Token. Token is stored securely in Blender `addon_preferences`.
- **FR-014 (Remote Asset Browsing):** The add-on must fetch the user's completed asset library directly within Blender.
  - *Priority:* P0
  - *Acceptance Criteria:* Displays asset list with names and thumbnail previews inside the Blender sidebar.
- **FR-015 (Direct Scene Import):** Clicking "Import into Scene" must download the asset and execute `bpy.ops.import_scene.gltf`.
  - *Priority:* P0
  - *Acceptance Criteria:* Imports mesh with PBR textures, centers origin to geometry base, places object on ground plane (Z=0), and frames camera.

---

## 8. Non-Functional Requirements (NFRs)

- **NFR-001 (Performance & Latency):** Web API endpoints must respond in < 150ms (excluding third-party AI generation time).
- **NFR-002 (Viewer Smoothness):** 3D viewer must maintain 60 FPS on standard modern desktop and laptop GPUs for models up to 100,000 polygons.
- **NFR-003 (Reliability & Retries):** Transient network errors during Tripo3D polling must retry with exponential backoff (up to 3 attempts) before failing.
- **NFR-004 (Durability):** Zero asset loss. All successful generation outputs must be durably stored in S3-compatible storage before client notification.
- **NFR-005 (Responsiveness):** Web interface must be fully functional on desktop (1920x1080, 1440x900) and tablet screens (>768px).

---

## 9. Security & Privacy Requirements (SEC)

- **SEC-001 (Secret Isolation):** `TRIPOSR_API_KEY` must strictly reside on the backend server / worker. It must never be exposed to browser clients, git repos, or Blender add-ons.
- **SEC-002 (Input Validation & Magic Bytes):** All uploaded image files must be verified on the backend by inspecting magic header bytes (`PNG` = `89 50 4E 47`, `JPEG` = `FF D8 FF`), not relying solely on client MIME headers or file extensions.
- **SEC-003 (Access Control & Data Isolation):** Users can only access, view, download, or delete assets that belong to their own account ID.
- **SEC-004 (Signed Storage Access):** Direct public access to object storage buckets must be prohibited. All asset downloads must use short-lived pre-signed URLs (15–60 minute TTL).
- **SEC-005 (Rate Limiting):** API endpoints for generation submissions must enforce rate limits (e.g. 5 requests per minute per user) to prevent credit exhaustion.

---

## 10. Success Metrics & Analytics

1. **Generation Success Rate:** >= 95% of submitted valid jobs reach `completed` status without provider exceptions.
2. **End-to-End Turnaround:** Average time from image upload to 3D preview < 60 seconds.
3. **Blender Import Success:** >= 99% of add-on import actions succeed without Python execution errors in Blender 3.6 and 4.x.
4. **Zero Secret Leakage:** 0 incidents of API keys appearing in client-facing payloads or logs.
