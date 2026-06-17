# tube — YouTube Transcript & Summary CLI

Fetch YouTube video transcripts and summarize them with Claude or Codex, all from the terminal.

## Prerequisites

- **Python 3.9+** — check with `python3 --version`
- **uv** — fast Python package manager ([install guide](https://docs.astral.sh/uv/getting-started/installation/))
- **pnpm** — JavaScript package manager for the web workspaces
- **Claude Code** — default summarization engine ([install guide](https://docs.anthropic.com/en/docs/claude-code))
- **Codex CLI** — optional summarization engine (`npm install -g @openai/codex`)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/gecko0/tube.git
cd tube
```

### 2. Install the CLI

```bash
uv tool install -e apps/cli
```

This installs `yt` as a global command available from any directory. The `-e` flag makes it editable — code changes take effect immediately without reinstalling.

### 3. Set up Claude Code (for summarization)

```bash
npm install -g @anthropic-ai/claude-code
claude login
```

Follow the prompts to authenticate. Without this, transcript fetching still works but summarization will be skipped with a helpful error message.

Summarization uses Claude Code's `sonnet` model alias by default. To use a different Claude Code model or alias, set `YT_CLAUDE_MODEL`:

```bash
export YT_CLAUDE_MODEL=opus
```

To use Codex instead, install and authenticate the Codex CLI:

```bash
npm install -g @openai/codex
codex login
yt config --ai_engine codex
```

### 4. Configure your shell

```bash
yt setup-shell
```

This adds aliases so you can paste YouTube URLs without quoting them. Without this, zsh will error on the `?` in URLs. After running, restart your terminal or `source ~/.zshrc`.

### 5. Verify the installation

```bash
yt -h
```

You should see:

```
Usage: yt [ARGS]...

  yt — YouTube Transcript & Summary CLI.

  Commands:
    yt                        Interactive mode
    yt <url>                  Fetch transcript & summarize a video
    yt --ai_engine codex <url> Summarize with Codex instead of Claude
    yt --model opus <url>     Summarize with a specific Claude model/alias
    yt --opus <url>           Shortcut for yt --model opus <url>
    yt list,    yt l          List latest 100 saved transcripts
    yt list --all             List all saved transcripts
    yt list --limit N         List latest N saved transcripts
    yt view,    yt v [video_id]    View transcript (latest if omitted)
    yt summary, yt s [video_id]    View summary (latest if omitted)
    yt delete,  yt d [video_id]    Delete transcript & summary (latest if omitted)
    yt web,     yt w [port]   Open web viewer (default port 8765)
    yt connect  <key>         Connect to cloud with API key
    yt config                 Show saved config
    yt config --ai_engine codex Set default AI engine
    yt config --model opus    Set default summarization model
    yt config --brief_summary_prompt @prompt.md Set brief summary prompt
    yt config reset --brief_summary_prompt Reset brief summary prompt
    yt config --api_key KEY   Set cloud API key
    yt sync                   Upload latest 100 local videos missing from cloud
    yt sync --all             Upload all local videos missing from cloud
    yt sync --limit N         Upload latest N local videos missing from cloud
    yt disconnect             Remove cloud connection
    yt setup-shell            Configure shell aliases for URLs

  [video_id] is a YouTube video ID.

Options:
  -h, --help  Show this message and exit.
```

### Uninstall

```bash
uv tool uninstall yt-cli
```

### Web development

The React apps use a pnpm workspace from the repository root:

```bash
pnpm install
pnpm --filter web-local build
pnpm --filter web build
```

Convex lives with the cloud web app. To install Convex's agent skills, run:

```bash
pnpm convex:skills
```

To run the cloud web app with Clerk auth, open
https://dashboard.clerk.com/apps/setup/convex and activate Clerk's Convex
integration for your Clerk app. The integration creates the `convex` JWT token
endpoint used by `ConvexProviderWithClerk`; without it, the browser will get a
404 from Clerk for `/tokens/convex` and Convex queries will fail as
unauthenticated.
If sign-in appears to succeed but the app cannot load data, check this setup
before debugging application queries.

Then copy Clerk's Frontend API URL, for example
`https://verb-noun-00.clerk.accounts.dev`, and set it on the matching Convex
deployment:

```bash
pnpm --filter web exec convex env set CLERK_JWT_ISSUER_DOMAIN https://verb-noun-00.clerk.accounts.dev
```

### Development setup

If you want to contribute or modify the code:

```bash
git clone https://github.com/gecko0/tube.git
cd tube
uv venv
source .venv/bin/activate
uv pip install -e "apps/cli[dev]"
rehash
```

This creates an isolated virtual environment with test dependencies (pytest) so your changes don't affect the global install. `rehash` refreshes zsh's command lookup after installing the `yt` and `tube` entry points.

## Usage

### Fetch and summarize a video

```bash
yt https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

This will:
1. Fetch video metadata (title, author) via YouTube oEmbed
2. Download the transcript
3. Save `transcript.md` to disk
4. Generate a brief orientation summary and save `brief_summary.md`
5. Generate the detailed summary and save `summary.md`

If the video was already fetched, you'll be asked whether to skip or regenerate.

Each video folder also includes `metadata.json` with structured video and processing metadata such as URL, author, fetched timestamp, AI engine, model, brief summary timestamp, and detailed summary timestamp. Cloud sync uploads this JSON metadata directly so the server does not need to parse markdown.

Claude is the default AI engine:

```bash
yt --model opus https://www.youtube.com/watch?v=dQw4w9WgXcQ
yt --model=opus https://www.youtube.com/watch?v=dQw4w9WgXcQ
yt --opus https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

To use Codex for one run:

```bash
yt --ai_engine codex https://www.youtube.com/watch?v=dQw4w9WgXcQ
yt --ai_engine=codex https://www.youtube.com/watch?v=dQw4w9WgXcQ
yt --ai_engine codex --model latest https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

For Codex, `latest` resolves to `gpt-5.5` and the CLI runs `codex exec --model gpt-5.5 -c model_reasoning_effort="medium" -`.

To save defaults in `~/.yt/config.json`:

```bash
yt config --ai_engine codex
yt config --model opus
```

To customize the brief orientation summary prompt:

```bash
yt config --brief_summary_prompt "Write a short orientation..."
yt config --brief_summary_prompt @prompt.md
yt config reset --brief_summary_prompt
```

The CLI `--ai_engine` and `--model` options override the saved config for that run.

Engine precedence is: CLI option, saved config, `YT_AI_ENGINE`, then `claude`.

Claude model precedence is: CLI option, saved config, `YT_CLAUDE_MODEL`, then `sonnet`.

Codex model precedence is: CLI option, saved config, `YT_CODEX_MODEL`, then `gpt-5.5`. If Codex receives a known Claude alias such as `opus`, `sonnet`, or `fable`, `yt` prints a warning and falls back to `gpt-5.5`.

### List saved transcripts

```bash
yt list             # latest 100, or: yt l
yt list --limit 25  # latest 25
yt list --all       # all saved transcripts
```

### View a transcript

```bash
yt view        # latest transcript
yt v dQw4w9WgXcQ   # by video ID
```

### View a summary

```bash
yt summary     # latest summary
yt s dQw4w9WgXcQ   # by video ID
```

### Delete a transcript

```bash
yt delete      # delete the latest transcript
yt d dQw4w9WgXcQ   # by video ID
```

You'll be asked to confirm before anything is deleted.

### Open web viewer

```bash
yt web         # opens browser at http://localhost:8765
yt w 9000      # custom port
```

This starts a local web server and opens a browser-based viewer with a sidebar of all saved videos, embedded YouTube player, and rendered summaries/transcripts.

### Cloud sync

Connect to the cloud backend to access your transcripts from anywhere:

```bash
# 1. Sign in at the web app and generate an API key in Settings
# 2. Connect your CLI
yt connect <your-api-key>

# Now every `yt <url>` will automatically sync to the cloud

# Upload the latest 100 local transcripts that are missing from the cloud
yt sync

# Override the default sync scope
yt sync --limit 250
yt sync --all

# To disconnect
yt disconnect
```

When connected, `yt <url>` saves locally as usual and also uploads to the Convex cloud backend. If the upload fails, the CLI warns but doesn't block.

Run `yt sync` after connecting a new API key to backfill recent local transcripts. By default it checks the latest 100 local videos. Use `yt sync --all` for a full backfill. The command asks Convex which local video IDs are missing and uploads only those videos.

### Interactive mode

Run `yt` with no arguments to get a menu:

```
╭──────────────────────────────╮
│  tube — YouTube Transcripts   │
╰──────────────────────────────╯

[1] Add new video
[2] List transcripts
[3] View transcript  (3 <video_id>)
[4] View summary     (4 <video_id>)
[5] Open web viewer
[6] Delete transcript (6 <video_id>)
[7] Sync missing videos
[8] Exit
```

In interactive mode you can combine action and reference in one input, e.g. `4 dQw4w9WgXcQ` to view a summary by video ID.

## Where files are stored

All transcripts and summaries are saved under `~/.yt/transcripts/`, organized by folder:

```
~/.yt/transcripts/
├── 2026-02-21 - dQw4w9WgXcQ - Never Gonna Give You Up/
│   ├── transcript.md
│   └── summary.md
└── 2026-02-20 - abc123xyz - How to Build a Rocket/
    ├── transcript.md
    └── summary.md
```

Folder naming: `YYYY-MM-DD - <video-id> - <sanitized-title>`

- Date is the fetch date (sorts lexicographically)
- Video ID guarantees uniqueness
- Title is sanitized (special chars stripped, max 60 chars)

To change the storage location, set the `YT_TRANSCRIPTS_DIR` environment variable:

```bash
export YT_TRANSCRIPTS_DIR=~/my-transcripts
```

To change the summarization model, set the `YT_CLAUDE_MODEL` environment variable:

```bash
export YT_CLAUDE_MODEL=opus
```

Or save it in `~/.yt/config.json`:

```bash
yt config --model opus
```

## Supported URL formats

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- Bare video ID (e.g. `dQw4w9WgXcQ`)

## Project structure

```
tube/
├── .python-version         # pinned Python version
├── README.md
├── AGENTS.md               # AI agent conventions
├── CLAUDE.md -> AGENTS.md
├── docs/
│   └── convex_rules.md     # Convex conventions
├── apps/
│   ├── cli/
│   │   ├── pyproject.toml  # package config, dependencies, entry points
│   │   ├── src/yt/
│   │   │   ├── main.py     # CLI entry point and commands
│   │   │   ├── transcript.py
│   │   │   ├── summarizer.py
│   │   │   ├── storage.py
│   │   │   ├── config.py
│   │   │   ├── cloud.py
│   │   │   ├── server.py
│   │   │   └── web/dist/   # pre-built local viewer (committed)
│   │   └── tests/          # Python CLI tests
│   ├── web/                # Cloud web app (React/Vite/shadcn + Convex + Clerk)
│   │   └── convex/         # Convex cloud backend
│   └── web-local/          # Local viewer source (builds to apps/cli/src/yt/web/dist/)
├── package.json
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

## How it works

1. **URL parsing** — Extracts the video ID from various YouTube URL formats
2. **Metadata** — Fetches title and author via YouTube's free [oEmbed API](https://oembed.com/) (no API key needed)
3. **Transcript** — Downloads captions using [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api)
4. **Storage** — Saves a timestamped `transcript.md` to `~/.yt/transcripts/`
5. **Summarization** — Pipes the transcript to `claude --model sonnet -p` by default and saves `summary.md`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b my-feature`)
3. Set up the development environment (see [Development setup](#development-setup))
4. Make your changes
5. Run `pnpm cli:test` to make sure all Python tests pass
6. Commit your changes (`git commit -m "Add my feature"`)
7. Push to your branch (`git push origin my-feature`)
8. Open a pull request

## License

MIT
