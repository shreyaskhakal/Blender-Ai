# Changelog

All notable changes to the **Blender AI** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] - Stage 0: Documentation & Architectural Foundation

### Added
- **Repository Audit (`docs/repo-audit.md`):** Conducted full technical inspection of the empty repository; established verified baseline (greenfield, 0 commits, clean working tree).
- **Product Requirements Document (`PRD.md`):** Complete product specification including personas, user journeys, stable functional requirements (`FR-001` through `FR-015`), non-functional requirements, and AI reconstruction constraints.
- **System Architecture (`ARCHITECTURE.md`):** System design specifications featuring C4 Level 1/2 diagrams, modular monolith architecture, async queue worker design, end-to-end Mermaid sequence diagrams, and technology stack selection.
- **UI/UX Design Specification (`design.md`):** Professional Blender-inspired dark design tokens (`#101216`, `#171B22`, `#22D3EE`), typography, layout breakpoints, Three.js WebGL viewport specs, and states.
- **Database Schema (`schema.md`):** PostgreSQL relational schema with Mermaid ER diagram covering `users`, `user_settings`, `generation_jobs`, `assets`, and `asset_events`.
- **REST API Specification (`API.md`):** Complete `/api/v1` route contracts, schemas, headers, error codes, and authentication methods.
- **Provider Integration Guide (`docs/tripo3d-integration.md`):** Official Tripo3D OpenAPI v3 specification covering file upload, task submission, status polling, 5-minute CDN lifespan handling, and mock provider strategy.
- **Specialist Agent Tickets (`docs/agent-tasks.md`):** Implementation work orders and boundary definitions for Agents A through G.
- **Architecture Decision Record (`docs/decisions/ADR-001-architecture.md`):** Formal justification for Modular Monolith with asynchronous BullMQ worker and S3 storage.
- **Agent Operating Instructions (`AGENTS.md`):** Permanent governance rules for Google Antigravity and future AI agents.
- **Roadmap (`ROADMAP.md`):** Dependency-gated stages from Stage 0 through Stage 9.
- **Security Policy (`SECURITY.md`):** Threat modeling, magic-byte upload validation, SSRF protection, glTF binary verification, and secret rotation procedures.
- **Deployment Runbook (`DEPLOYMENT.md`):** Docker Compose local development and production container deployment runbooks.
- **Testing Strategy (`TESTING.md`):** Test pyramid, credit protection rules, and Blender headless test suite definitions.
- **Contributing Guidelines (`CONTRIBUTING.md`):** Development setup, prerequisites, and pull request conventions.
- **Environment Template (`.env.example`):** Documented environment variable definitions with clear separation between server secrets and browser variables.
