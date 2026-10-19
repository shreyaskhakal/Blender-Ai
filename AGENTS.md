# Operating Instructions for AI Agents (Antigravity & Future Agents)

**Project:** Blender AI  
**Repository:** [https://github.com/shreyaskhakal/Blender-Ai](https://github.com/shreyaskhakal/Blender-Ai)  
**Document Status:** Permanent Governance Document  

---

## 1. Product Mission & Ground Truth

Blender AI empowers creators by converting 2D images into textured 3D models via Tripo3D's hosted API, rendering interactive WebGL previews, durably storing assets, and importing models into Blender via a native Python add-on.

### Authoritative Documentation Hierarchy
1. [docs/repo-audit.md](file:///C:/Users/user5/.gemini/antigravity-ide/scratch/Blender-Ai/docs/repo-audit.md) — Verified technical baseline.
2. [docs/tripo3d-integration.md](file:///C:/Users/user5/.gemini/antigravity-ide/scratch/Blender-Ai/docs/tripo3d-integration.md) — Official provider contracts.
3. [docs/decisions/ADR-001-architecture.md](file:///C:/Users/user5/.gemini/antigravity-ide/scratch/Blender-Ai/docs/decisions/ADR-001-architecture.md) — Architecture decisions.
4. [schema.md](file:///C:/Users/user5/.gemini/antigravity-ide/scratch/Blender-Ai/schema.md) & [API.md](file:///C:/Users/user5/.gemini/antigravity-ide/scratch/Blender-Ai/API.md) — Database and REST contracts.
5. [ROADMAP.md](file:///C:/Users/user5/.gemini/antigravity-ide/scratch/Blender-Ai/ROADMAP.md) & [docs/agent-tasks.md](file:///C:/Users/user5/.gemini/antigravity-ide/scratch/Blender-Ai/docs/agent-tasks.md) — Staging and execution boundaries.

---

## 2. Cardinal Rules & Prohibited Shortcuts

> [!CAUTION]
> Violation of any of the following rules is unacceptable:

1. **NEVER Commit Secrets:** Never commit real API keys, tokens, or credentials to Git. Use environment variables defined in `.env.example`.
2. **NEVER Leak Provider Keys to Clients:** The provider secret `TRIPOSR_API_KEY` must only exist in backend API and worker processes. Never bundle or expose it in frontend code or Blender preferences.
3. **NEVER Claim Fake Integrations:** Never fabricate successful test executions, mock responses as live AI outputs, or claim a feature works without running a verified test.
4. **NEVER Spend Paid Credits in Unit/CI Tests:** Automated unit tests and continuous integration workflows must use `Tripo3DMockClient` (`TRIPO3D_USE_MOCK=true`). Live API calls are strictly restricted to manual smoke tests.
5. **NEVER Silently Bypass Authentication or Ownership:** Every asset operation (`view`, `download`, `delete`) must verify that `asset.user_id === authenticated_user.id`.
6. **NEVER Guess Provider Endpoints:** All Tripo3D API interactions must strictly match the verified OpenAPI v3 contract documented in [docs/tripo3d-integration.md](file:///C:/Users/user5/.gemini/antigravity-ide/scratch/Blender-Ai/docs/tripo3d-integration.md).
7. **NEVER Delete Unrelated Working Code:** Always inspect existing code before modifying. Preserve existing architecture and tests.

---

## 3. Engineering & Code Standards

### 3.1 TypeScript & Node.js
- Enable TypeScript `strict: true` across all packages.
- No `any` types; define explicit interfaces or use `unknown` with type guards.
- Use ES Modules (`"type": "module"`).
- Lint with ESLint and format with Prettier.

### 3.2 Python & Blender Add-on
- Python 3.10+ compatible with Blender 3.6 LTS and Blender 4.x.
- Follow PEP 8 guidelines.
- Register all UI panels and operators cleanly in `bpy.utils.register_class()`.
- Use `addon_preferences` for storing API tokens.

### 3.3 Database & Migrations
- All PostgreSQL schema changes must be authored via Prisma migrations or SQL migration scripts.
- Schema changes must be backward-compatible and additive.
- Binary assets must never be stored in database columns; store S3 object keys.

---

## 4. Agent Completion Checklist

Before reporting completion on any implementation ticket, the agent must verify:
- [ ] Working directory status is clean or only contains expected modifications (`git status`).
- [ ] No secrets or `.env` files with real keys are tracked.
- [ ] All new code is accompanied by corresponding unit or integration tests.
- [ ] All tests pass locally (`pnpm test` and `pytest`).
- [ ] Documentation (`API.md`, `schema.md`, `CHANGELOG.md`) is updated if contracts changed.
- [ ] Clear instructions and exact Git review commands are provided to the user.
