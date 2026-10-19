# Security Policy & Security Architecture

**Document Version:** 1.0.0  
**Status:** Approved Security Baseline  
**Security Lead:** Principal Security Engineer  

---

## 1. Threat Model & Key Security Boundaries

Blender AI processes user-uploaded binary images, communicates with external AI services, runs background workers, and distributes 3D assets to web browsers and desktop Blender installations. 

```
[Public Web Browser / Blender Add-on]
       │
       │  (Boundary 1: Strict Ingress Auth & Validation)
       ▼
[Fastify REST API]
       │
       │  (Boundary 2: Internal VPC / Isolated Docker Network)
       ▼
[PostgreSQL / Redis / MinIO / Background Worker]
       │
       │  (Boundary 3: Egress Whitelist & Secret Isolation)
       ▼
[External Tripo3D API]
```

---

## 2. API Key Protection & Secret Management

- **Provider Secret (`TRIPOSR_API_KEY`):**
  - Stored strictly in server-side environment variables.
  - Loaded exclusively by the backend API and worker processes.
  - **Zero Frontend Leakage:** Vite frontend builds must never reference `TRIPOSR_API_KEY`. No variable prefixed with `VITE_` may contain provider secrets.
  - Automated CI secret scanners (e.g. `gitleaks` / `trufflehog`) run on every pull request.
- **Blender User API Tokens (`bai_...`):**
  - Generated using cryptographically secure random bytes (`crypto.randomBytes(24).toString('hex')`).
  - Hashed in the database using SHA-256 before storage; the raw token is shown only once to the user upon generation.
  - Stored in Blender's local user configuration (`addon_preferences`), never in global desktop registries or shared paths.

---

## 3. Upload Validation & Defense-in-Depth

Untrusted image uploads represent a primary attack surface (e.g. polyglot files, zip bombs, malware disguised as images). The system enforces a three-tier validation pipeline:

1. **Client-Side Validation:** Immediate rejection in the browser if MIME type is not `image/png` or `image/jpeg`, or if file size exceeds 20 MB.
2. **Pre-Signed Upload Constraints:** S3 upload policy enforces:
   - `content-length-range`: Min 100 bytes, Max 20,971,520 bytes (20 MB).
   - Strict `Content-Type` matching.
3. **Server-Side Magic Header Inspection:**
   - Before passing the file to Tripo3D, the server reads the initial 8 bytes of the binary:
     - `PNG`: Must begin with `89 50 4E 47 0D 0A 1A 0A`.
     - `JPEG`: Must begin with `FF D8 FF`.
   - Files failing magic-byte inspection are immediately quarantined and deleted.

---

## 4. SSRF (Server-Side Request Forgery) Prevention

The worker downloads assets from Tripo3D CDN URLs. To prevent SSRF attacks:
- The worker strictly whitelists permitted egress domains:
  - `https://openapi.tripo3d.ai/*`
  - `https://*.tripo3d.ai/*`
- All other external URLs in task payloads are rejected.
- Private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.169.254`) are blocked at the HTTP client transport layer.

---

## 5. Output File Validation (glTF / GLB Verification)

Before delivering 3D models to users or Blender:
- The worker verifies the 4-byte magic header of downloaded `.glb` files:
  - Header: `0x46546C67` (ASCII string `"glTF"`).
  - Version: Header bytes 4–7 must declare glTF version 2 (`0x00000002`).
- Prevents corrupt files, error HTML pages, or malicious scripts from being stored as models.

---

## 6. Access Control & Data Isolation

- **Tenant Isolation:** Every database query for assets or generation jobs includes a strict `WHERE user_id = :current_user_id` clause.
- **Pre-Signed Download URLs:**
  - Asset storage buckets are strictly private (`BlockPublicAcls = true`).
  - Downloads are accessed exclusively through time-limited pre-signed URLs with a maximum lifespan of **15 minutes**.
- **Rate Limiting:**
  - Generation submission endpoints are throttled to a maximum of **5 requests per minute** per user to prevent credit exhaustion.
  - General API routes are throttled to 60 requests per minute per IP.

---

## 7. Logging & Secret Redaction

- Application logs use structured JSON format (Pino).
- An automated redaction filter masks sensitive patterns:
  - `TRIPOSR_API_KEY`, `Authorization`, `password`, `api_token`, `cookie`.
- Provider error messages are sanitized before being returned to users (e.g. internal network traces are logged internally, while the user receives a safe generic error code).

---

## 8. Incident Response & Key Rotation Procedure

If `TRIPOSR_API_KEY` is suspected of being compromised:
1. **Immediate Revocation:** Navigate to [https://platform.tripo3d.ai/api-keys](https://platform.tripo3d.ai/api-keys) and revoke the compromised key.
2. **Generate New Key:** Create a new API key in the Tripo3D console.
3. **Update Environment:** Update the backend environment secret `TRIPOSR_API_KEY` in the hosting environment (e.g. Kubernetes Secret or Docker environment).
4. **Restart Services:** Perform a zero-downtime rolling restart of `apps/api` and `apps/worker`.
5. **Verify Connectivity:** Run the automated smoke test script (`scripts/tripo-smoke-test.ts`).

---

## 9. Reporting a Vulnerability

Please report security issues responsibly. Do not open public GitHub issues for security vulnerabilities. Email disclosures to `security@blender-ai.local` (or the repository maintainers). All reports will be acknowledged within 48 hours.
