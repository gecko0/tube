# tube — YouTube Transcript & Summary CLI

Fetch YouTube video transcripts and summarize them with Claude, all from the terminal.

## Prerequisites

- **Python 3.9+** — check with `python3 --version`
- **uv** — fast Python package manager ([install guide](https://docs.astral.sh/uv/getting-started/installation/))
- **Claude Code** — required for summarization ([install guide](https://docs.anthropic.com/en/docs/claude-code))

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/gecko0/tube.git
cd tube
```

### 2. Install the CLI

```bash
uv tool install -e .
```

This installs `yt` as a global command available from any directory. The `-e` flag makes it editable — code changes take effect immediately without reinstalling.

### 3. Set up Claude Code (for summarization)

```bash
npm install -g @anthropic-ai/claude-code
claude login
```

Follow the prompts to authenticate. Without this, transcript fetching still works but summarization will be skipped with a helpful error message.

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
    yt list,    yt l          List all saved transcripts
    yt view,    yt v [ref]    View transcript (latest if no ref)
    yt summary, yt s [ref]    View summary (latest if no ref)
    yt delete,  yt d [ref]    Delete transcript & summary (latest if no ref)
    yt web,     yt w [port]   Open web viewer (default port 8765)
    yt setup-shell            Configure shell aliases for URLs

  [ref] can be a # index from the list or a video ID.

Options:
  -h, --help  Show this message and exit.
```

### Uninstall

```bash
uv tool uninstall yt-cli
```

### Development setup

If you want to contribute or modify the code:

```bash
git clone https://github.com/gecko0/tube.git
cd tube
uv venv
source .venv/bin/activate
uv pip install -e ".[dev]"
```

This creates an isolated virtual environment with test dependencies (pytest) so your changes don't affect the global install.

## Usage

### Fetch and summarize a video

```bash
yt https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

This will:
1. Fetch video metadata (title, author) via YouTube oEmbed
2. Download the transcript
3. Save `transcript.md` to disk
4. Summarize via `claude -p` and save `summary.md`

If the video was already fetched, you'll be asked whether to skip or regenerate.

### List saved transcripts

```bash
yt list        # or: yt l
```

### View a transcript

```bash
yt view        # latest transcript
yt v 3         # transcript #3 from the list
yt v dQw4w9WgXcQ   # by video ID
```

### View a summary

```bash
yt summary     # latest summary
yt s 3         # summary #3 from the list
yt s dQw4w9WgXcQ   # by video ID
```

### Delete a transcript

```bash
yt delete      # delete the latest transcript
yt d 3         # delete transcript #3 from the list
yt d dQw4w9WgXcQ   # by video ID
```

You'll be asked to confirm before anything is deleted.

### Open web viewer

```bash
yt web         # opens browser at http://localhost:8765
yt w 9000      # custom port
```

This starts a local web server and opens a browser-based viewer with a sidebar of all saved videos, embedded YouTube player, and rendered summaries/transcripts.

### Interactive mode

Run `yt` with no arguments to get a menu:

```
╭──────────────────────────────╮
│  tube — YouTube Transcripts   │
╰──────────────────────────────╯

[1] Add new video
[2] List transcripts
[3] View transcript  (3 <#|id>)
[4] View summary     (4 <#|id>)
[5] Open web viewer
[6] Delete transcript (6 <#|id>)
[7] Exit
```

In interactive mode you can combine action and reference in one input, e.g. `4 1` to view the summary of transcript #1.

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

## Supported URL formats

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- Bare video ID (e.g. `dQw4w9WgXcQ`)

## Project structure

```
tube/
├── pyproject.toml          # package config, dependencies, entry point
├── .python-version         # pinned Python version
├── README.md
├── AGENTS.md               # AI agent conventions
├── CLAUDE.md -> AGENTS.md
├── yt/
│   ├── __init__.py
│   ├── main.py             # CLI entry point and commands
│   ├── transcript.py       # fetch transcript and metadata from YouTube
│   ├── summarizer.py       # call claude -p for summarization
│   ├── storage.py          # list, read, find saved folders
│   ├── config.py           # paths and constants
│   ├── server.py           # FastAPI web server for browser UI
│   └── web/dist/           # pre-built React frontend (committed)
├── web/                    # React/Vite/shadcn frontend source
└── tests/
    ├── conftest.py         # shared test fixtures
    ├── test_transcript.py
    ├── test_storage.py
    ├── test_summarizer.py
    ├── test_server.py
    └── test_main.py
```

## How it works

1. **URL parsing** — Extracts the video ID from various YouTube URL formats
2. **Metadata** — Fetches title and author via YouTube's free [oEmbed API](https://oembed.com/) (no API key needed)
3. **Transcript** — Downloads captions using [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api)
4. **Storage** — Saves a timestamped `transcript.md` to `~/.yt/transcripts/`
5. **Summarization** — Pipes the transcript to `claude -p` and saves `summary.md`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b my-feature`)
3. Set up the development environment (see [Development setup](#development-setup))
4. Make your changes
5. Run `pytest -v` to make sure all tests pass
6. Commit your changes (`git commit -m "Add my feature"`)
7. Push to your branch (`git push origin my-feature`)
8. Open a pull request

## License

MIT
