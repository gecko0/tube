# AGENTS.md

## Project overview

`yt` (also aliased as `tube`) is a CLI tool that fetches YouTube video transcripts and summarizes them using Claude. It stores transcripts and summaries as markdown files on disk and optionally syncs them to a Convex cloud backend for remote access.

## Tech stack

- Python 3.9+
- Click (CLI framework)
- Rich (terminal output)
- requests (HTTP)
- youtube-transcript-api (transcript fetching)
- Claude CLI (`claude -p`) for summarization (external subprocess)
- FastAPI + Uvicorn (local web viewer backend)
- React 19 + Vite + shadcn/ui + Tailwind CSS v4 (local web viewer frontend)
- Convex (cloud backend — schema, functions, HTTP endpoints)
- Clerk (authentication for cloud web app)
- React 19 + Vite + shadcn/ui + Convex + Clerk (cloud web app frontend)

## Project structure

```
yt/
├── config.py       # Constants: TRANSCRIPTS_DIR, OEMBED_URL, MAX_TITLE_LENGTH
├── transcript.py   # Video ID extraction, metadata/transcript fetching, markdown building, saving
├── storage.py      # Listing, finding, reading saved transcripts and summaries
├── summarizer.py   # Claude-based summarization, summary markdown building, saving
├── server.py       # FastAPI web server, API routes, static file serving
├── cloud.py        # Cloud sync: config management, upload to Convex
├── main.py         # CLI entry point (Click commands, interactive mode)
├── web/dist/       # Pre-built React frontend (committed, no Node.js at runtime)
convex/             # Convex cloud backend (see convex_rules.md for conventions)
├── schema.ts       # Table definitions (videos, apiKeys)
├── videos.ts       # Public queries/mutations for videos (Clerk auth)
├── apiKeys.ts      # API key CRUD (Clerk auth)
├── http.ts         # HTTP endpoint for CLI upload (API key auth)
├── auth.ts         # Internal helpers (resolve API key, upsert video)
├── auth.config.ts  # Clerk JWT provider config
web/                # Cloud web app (React/Vite/shadcn + Convex + Clerk)
web-local/          # Local web viewer source (builds to yt/web/dist/)
tests/
├── conftest.py     # Shared fixtures: frozen_date, transcripts_dir, sample_entries
├── test_main.py
├── test_transcript.py
├── test_storage.py
├── test_summarizer.py
├── test_server.py
├── test_cloud.py
```

## Setup

```bash
pip install -e ".[dev]"
pnpm install
```

The JavaScript apps are managed with pnpm workspaces from the repository root. Use `pnpm --filter web-local ...` for the local viewer source and `pnpm --filter web ...` for the cloud web app.

## Testing

Tests use `pytest`. Run from the project root:

```bash
pytest -v
```

**After every code modification, run the full test suite and verify all tests pass before considering the task complete.**

### Test conventions

- Tests live in `tests/` and mirror the source module names (`test_transcript.py` tests `yt/transcript.py`, etc.).
- Shared fixtures are in `tests/conftest.py`.
- `frozen_date` fixture patches `date.today()` in `yt.transcript` and `yt.summarizer` to return `2025-06-15`.
- `transcripts_dir` fixture redirects `TRANSCRIPTS_DIR` in `yt.config`, `yt.storage`, and `yt.transcript` to a `tmp_path` subdirectory. When patching `TRANSCRIPTS_DIR`, you must patch it in **all modules that import it** (currently `yt.config`, `yt.storage`, `yt.transcript`, and `yt.server`) since each holds its own imported reference.
- No network calls, no real filesystem side effects, no subprocess calls in tests. Use `unittest.mock.patch` for external dependencies and `tmp_path` for filesystem operations.

### Bug fix workflow

When fixing a bug:

1. **Write a failing test first** that reproduces the bug.
2. Verify the test fails.
3. Fix the code.
4. Verify the test (and all other tests) pass.

## Documentation

When changing CLI commands, flags, output format, or user-facing behavior, update `README.md` to match. This includes the help output block, usage examples, and the interactive mode section.

## Key design details

- `TRANSCRIPTS_DIR` defaults to `~/.yt/transcripts` but can be overridden via the `YT_TRANSCRIPTS_DIR` environment variable.
- Folder naming convention: `YYYY-MM-DD - <video_id> - <sanitized_title>`. The `parse_folder_name` function in `storage.py` parses this format.
- `summarize()` shells out to `claude -p <prompt>` and checks for the binary via `shutil.which` first.
- `fetch_metadata` uses YouTube's oEmbed endpoint and falls back to `{"title": video_id, "author": "Unknown"}` on any error.
- `yt web` starts a FastAPI/Uvicorn server serving both a JSON API and the pre-built React SPA from `yt/web/dist/`.
- The local React frontend source lives in `web-local/` and builds to `yt/web/dist/`. The built files are committed so users don't need Node.js at runtime.
- The cloud web app lives in `web/` and uses Convex + Clerk for backend and auth.
- `yt/cloud.py` manages cloud config (`~/.yt/config.json`) and uploads to Convex via HTTP endpoint.
- `yt connect <key>` stores an API key for cloud sync. `yt disconnect` removes it.
- After `add_video`, if connected, the CLI automatically uploads to Convex (non-blocking, warns on failure).

## Convex backend

- Backend functions live in `convex/`. Follow conventions in `convex_rules.md`.
- Schema is in `convex/schema.ts` with `videos` and `apiKeys` tables, all user-scoped.
- HTTP endpoint at `/api/upload` authenticates CLI via API key (SHA-256 hash lookup).
- Auth uses Clerk for the web app and API keys for the CLI.
