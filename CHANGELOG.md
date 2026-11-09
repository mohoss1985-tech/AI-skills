# Changelog

All notable changes to Analyst Kit. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased] — 2.0.0

V2 turns each skill into a working tool. V1 stays published at `/v1/` (git tag `v1.0.0`).

### Added
- Tool workspaces: `/api/workspaces` (create, read, update, delete), runs history (last 50 per workspace),
  "Save as deliverable" (`/publish`: tool output becomes a deliverable, earlier outputs kept as versions with the
  tool state), "Ask Claude" from a tool (`/ai`), "Open in tool" on deliverables made from a tool.
- Plug-in routes: any `app/server/tools/*.py` registers endpoints with `@route` (API tester proxy, SQL runner, mocks).
- `GET /api/catalog` and an `ETag` on `GET /api/state` (the 3 s poll answers `304` when nothing changed).
- `kit.py patch <workspace_id> <file.json>`: Claude fills a tool directly, validated against the tool's JSON Schema.
- `kit.py pending` shows message ids, and for tool messages the workspace state and the run they refer to.
- Per-tool SQL migrations (`app/server/migrations/NNN_<tool>.sql`).
- Backend test suite (`python3 -m unittest discover -s app/server/tests -t app/server`), run by the Pages workflow.
- Static demo: `data/catalog.json`, `data/samples/<tool>.json`; Pages publishes V2 at `/` and V1 at `/v1/`.
- Licences: MIT for code (`LICENSE`), CC BY 4.0 for content (`LICENSE-CONTENT`).

### Changed
- Code split into `app/server/` (router, db with numbered migrations, catalog, routes) and `app/web/` (ES modules).
- Errors are JSON `{"error": {"code", "message"}}` with stable codes the UI translates (EN/FR).
- `/api/state` no longer re-reads the seed files and runs 2 grouped queries instead of 2 per deliverable.
- Indexes on messages and versions.

### Fixed
- `kit.py reply` marked every unanswered message of a thread as handled, losing messages posted while Claude was
  writing. It now marks only `--ids`, or by default only messages older than the reply file.
- Malformed JSON or a bad `Content-Length` dropped the connection; they now answer a JSON error.
- `kit.py start|deliver|reply` with an unknown id or missing argument printed a traceback.

### Security
- Writes need a per-boot `X-Kit-Token` (from `GET /api/config`), JSON bodies only, Host and Origin checks:
  closes the V1 CSRF / DNS-rebinding path through which any web page could post a message to Claude Code.
- Body size caps, `X-Content-Type-Options: nosniff`, uploaded files served with a sandbox CSP, no CORS.

## [1.0.0] — 2026-11-02

First public version.

### Added
- 18 AI skills for BA/PO work in card payments (Visa samples in English, CB samples in French).
- Local app: request a deliverable, Claude (Claude Code session) writes it through `kit.py`; conversation per
  deliverable, versions, Word / PDF / Copy exports, mark as sent, continue from a document, uploads as sources,
  profile and learned preferences, general chat, guided questions, FR/EN interface, light/dark themes, Guide.
- Read-only static demo on GitHub Pages.

[Unreleased]: https://github.com/mohoss1985-tech/AI-skills/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mohoss1985-tech/AI-skills/releases/tag/v1.0.0
