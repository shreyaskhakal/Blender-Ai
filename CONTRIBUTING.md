# Contributing to Blender AI

Thank you for your interest in contributing to **Blender AI**! This guide outlines our development workflow, standards, and contribution processes.

---

## 1. Code of Conduct & Core Rules

1. **Never commit secrets:** Never commit real API keys, credentials, or private tokens to the repository.
2. **Offline Tests by Default:** Automated tests must never incur financial costs or spend third-party AI credits. Use mock providers for all CI and local testing.
3. **Contract Integrity:** Changes to database schemas ([schema.md](file:///C:/Users/user5/.gemini/antigravity-ide/scratch/Blender-Ai/schema.md)) or REST contracts ([API.md](file:///C:/Users/user5/.gemini/antigravity-ide/scratch/Blender-Ai/API.md)) must be proposed via an Architecture Decision Record (ADR) before implementation.

---

## 2. Development Prerequisites

Ensure you have the following installed on your workstation:
- **Node.js:** `>= 20.x LTS` (Check with `node -v`)
- **Package Manager:** `pnpm >= 9.x` (`npm install -g pnpm`)
- **Docker & Docker Compose:** Docker Engine `>= 24.x` (for local Postgres, Redis, MinIO)
- **Python:** Python `3.10+` or `3.11` (for Blender add-on development)
- **Blender:** Blender `3.6 LTS` or `4.x` (for add-on testing)

---

## 3. Local Workspace Setup

```bash
# 1. Clone your fork or the repository
git clone https://github.com/shreyaskhakal/Blender-Ai.git
cd Blender-Ai

# 2. Configure environment
cp .env.example .env

# 3. Start local backing services
docker compose up -d postgres redis minio

# 4. Install workspace dependencies
pnpm install

# 5. Apply database migrations
pnpm --filter @blender-ai/database prisma migrate dev

# 6. Start the local development server
pnpm dev
```

---

## 4. Branch & Commit Conventions

### Branch Naming
- Features: `feat/short-description` (e.g. `feat/threejs-lighting-presets`)
- Bug Fixes: `fix/short-description` (e.g. `fix/magic-byte-parsing`)
- Documentation: `docs/short-description` (e.g. `docs/update-api-contract`)

### Commit Messages (Conventional Commits)
Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:
- `feat(api): add face_limit parameter to generation request`
- `fix(worker): handle 504 gateway timeout from provider adapter`
- `docs(readme): add installation guide for blender 4.1`
- `test(storage): add magic byte verification unit tests`

---

## 5. Coding & Linting Standards

- **TypeScript:** Strict mode enabled. No `any` types. Run `pnpm lint` before pushing.
- **Formatting:** Formatted with Prettier (`pnpm format`).
- **Python:** Compliant with PEP 8 and Blender Python API conventions. Run `ruff check blender_addon/`.

---

## 6. Submitting a Pull Request (PR)

1. Ensure all tests pass: `pnpm test`.
2. Ensure linting passes: `pnpm lint`.
3. Verify Git status is clean and no untracked `.env` files are staged.
4. Fill out the PR template completely, referencing any related issue tickets from [docs/agent-tasks.md](file:///C:/Users/user5/.gemini/antigravity-ide/scratch/Blender-Ai/docs/agent-tasks.md).
