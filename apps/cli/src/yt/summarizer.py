import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from .config import AI_ENGINE, CLAUDE_MODEL, CODEX_MODEL, CODEX_REASONING_EFFORT
from .cloud import load_config
from .metadata import update_video_metadata

AI_ENGINES = {"claude", "codex"}
CLAUDE_MODEL_ALIASES = {"sonnet", "opus", "fable"}
BRIEF_SUMMARY_PROMPT_KEY = "brief_summary_prompt"
DEFAULT_BRIEF_SUMMARY_PROMPT = """You are writing a brief orientation summary for a YouTube video.

The goal is not to teach the material in depth and not to extract every useful lesson. The goal is to help a busy reader quickly understand what the video is about, what ground it covers, and whether it is worth reading the detailed summary.

Video title: {title}
Video URL: {video_url}

Write markdown only.

Output structure:

Start with one short paragraph:
- Say what kind of video this is.
- Name the speaker/creator if the transcript or metadata makes that clear.
- Explain the central idea in plain language.
- Keep it to 1-2 sentences.

Then add:

### Key Sections

* **<section title> (<timestamp or timestamp range>):** Briefly describe what this part of the video covers.
* **<section title> (<timestamp or timestamp range>):** Briefly describe what this part of the video covers.
* **<section title> (<timestamp or timestamp range>):** Briefly describe what this part of the video covers.

If the video clearly ends with concrete steps, add:

### Main Advice

1. One short sentence.
2. One short sentence.
3. One short sentence.

Rules:
- Keep the whole output easy to scan, usually 150-250 words.
- Use 3-6 key sections.
- Be descriptive, not exhaustive.
- Do not turn this into the detailed summary.
- Do not write deep explanations, implementation details, or long takeaways.
- Include timestamps when the transcript supports them.
- Format timestamps as markdown links to the YouTube URL with `&t=<seconds>s`.
- If exact timestamp ranges are uncertain, use a single linked start timestamp.
- Do not invent timestamps or speaker names.
- Do not mention that you are reading a transcript.

Transcript:
<transcript>
{transcript_text}
</transcript>"""


@dataclass(frozen=True)
class SummaryMetadata:
    ai_engine: str
    model: str


def resolve_ai_engine(
    ai_engine: str | None = None,
    config: dict[str, str] | None = None,
) -> str:
    """Resolve the selected AI engine from CLI, config, env, or default."""
    saved_config = config if config is not None else load_config()
    resolved = (ai_engine or saved_config.get("ai_engine") or AI_ENGINE).lower()
    if resolved not in AI_ENGINES:
        raise ValueError(
            f"Unsupported ai_engine: {resolved}. "
            "Supported engines: claude, codex."
        )
    return resolved


def resolve_model(
    ai_engine: str,
    model: str | None = None,
    config: dict[str, str] | None = None,
) -> str:
    """Resolve a model for the selected AI engine."""
    saved_config = config if config is not None else load_config()

    if ai_engine == "claude":
        return model or saved_config.get("model") or CLAUDE_MODEL

    candidate = model or saved_config.get("model") or CODEX_MODEL
    normalized = candidate.lower()
    if normalized == "latest":
        return CODEX_MODEL
    if normalized in CLAUDE_MODEL_ALIASES:
        print(
            f"Warning: model '{candidate}' is not compatible with Codex; "
            f"using {CODEX_MODEL}.",
            file=sys.stderr,
        )
        return CODEX_MODEL
    return candidate


def resolve_summary_metadata(
    model: str | None = None,
    ai_engine: str | None = None,
    config: dict[str, str] | None = None,
) -> SummaryMetadata:
    saved_config = config if config is not None else load_config()
    resolved_engine = resolve_ai_engine(ai_engine, saved_config)
    resolved_model = resolve_model(resolved_engine, model, saved_config)
    return SummaryMetadata(ai_engine=resolved_engine, model=resolved_model)


def build_summary_prompt(transcript_text: str, title: str) -> str:
    return f"""You are an expert content analyst. Your job is to distill a YouTube video transcript into a dense, actionable reference document. The reader is busy — they want the gold, not the fluff.

Video title: {title}

Work through these stages in order:

<stage1>
ANALYZE THE VIDEO
- What type of content is this? (technical tutorial, business/startup, opinion/commentary, educational, interview, etc.)
- Who is the target audience? (beginners, intermediate developers, founders, managers, etc.)
- Identify 3-7 distinct topics or themes discussed in the video. Each topic should be a coherent subject that could stand on its own.
</stage1>

<stage2>
DEEP-DIVE EACH TOPIC
For each topic you identified, write a focused section. Adapt the structure to the content type:

For technical content — describe the thing, why it is interesting, how to use it, what to do, what not to do, gotchas.
For business/strategy content — describe the idea, why it matters, what to do, what not to do, examples.
For educational content — explain the concept, why it is important, practical applications, common misconceptions.

For every topic, always include:
- A 1-2 sentence explanation of what it is
- Why it matters to the target audience
- Concrete takeaways: things to do, try, or apply
- Pitfalls: things to avoid, common mistakes, or misconceptions (skip this section if there genuinely aren't any)
</stage2>

<stage3>
OUTPUT FORMAT
Produce the final document in this exact markdown structure. Do NOT include the stage analysis — only the final document.

```
# <video title>

> **Type**: <content type> | **Audience**: <target audience> | **Topics**: <count>

## TLDR
2-3 sentences. The elevator pitch. If the reader only reads this, they should get the core message.

## <Topic Name>
<1-2 sentence explanation of what this topic is about>

**Why it matters**: <1-2 sentences on why the reader should care>

### Takeaways
- <actionable point — start with a verb: use, avoid, consider, prefer, etc.>
- ...

### Pitfalls
- <thing to avoid or common mistake>
- ...

## <Next Topic Name>
...
```

IMPORTANT RULES:
- No filler phrases like "the speaker discusses" or "in this video". Write as if you ARE the expert teaching the reader directly.
- Every bullet must be actionable or informative. No padding.
- Use specific details from the transcript — names, numbers, tools, examples.
- If the speaker gives a concrete recommendation, include it verbatim or paraphrased tightly.
- Keep it dense. The entire output should be something you can read in 2-5 minutes regardless of video length.
</stage3>

<transcript>
{transcript_text}
</transcript>"""


def render_prompt_template(
    template: str,
    *,
    transcript_text: str,
    title: str,
    video_id: str,
) -> str:
    return (
        template.replace("{title}", title)
        .replace("{video_url}", f"https://youtube.com/watch?v={video_id}")
        .replace("{transcript_text}", transcript_text)
    )


def build_brief_summary_prompt(
    transcript_text: str,
    title: str,
    video_id: str,
    config: dict[str, str] | None = None,
) -> str:
    saved_config = config if config is not None else load_config()
    template = saved_config.get(BRIEF_SUMMARY_PROMPT_KEY, DEFAULT_BRIEF_SUMMARY_PROMPT)
    return render_prompt_template(
        template,
        transcript_text=transcript_text,
        title=title,
        video_id=video_id,
    )


def run_claude(prompt: str, model: str) -> str:
    if not shutil.which("claude"):
        raise FileNotFoundError(
            "claude CLI not found. Install Claude Code and run `claude login`.\n"
            "See: https://docs.anthropic.com/en/docs/claude-code"
        )

    result = subprocess.run(
        [
            "claude",
            "--model",
            model,
            "-p",
            prompt,
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def run_codex(prompt: str, model: str) -> str:
    if not shutil.which("codex"):
        raise FileNotFoundError(
            "codex CLI not found. Install Codex and run `codex login`.\n"
            "See: https://developers.openai.com/codex/cli"
        )

    result = subprocess.run(
        [
            "codex",
            "exec",
            "--model",
            model,
            "-c",
            f'model_reasoning_effort="{CODEX_REASONING_EFFORT}"',
            "-",
        ],
        input=prompt,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def run_prompt(prompt: str, metadata: SummaryMetadata) -> str:
    if metadata.ai_engine == "claude":
        return run_claude(prompt, metadata.model)
    return run_codex(prompt, metadata.model)


def summarize_brief(
    transcript_text: str,
    title: str,
    video_id: str,
    model: str | None = None,
    ai_engine: str | None = None,
    metadata: SummaryMetadata | None = None,
) -> str:
    """Call the selected AI engine to create a brief orientation summary."""
    metadata = metadata or resolve_summary_metadata(model=model, ai_engine=ai_engine)
    prompt = build_brief_summary_prompt(transcript_text, title, video_id)
    return run_prompt(prompt, metadata)


def summarize(
    transcript_text: str,
    title: str,
    model: str | None = None,
    ai_engine: str | None = None,
    metadata: SummaryMetadata | None = None,
) -> str:
    """Call the selected AI engine to summarize a transcript."""
    metadata = metadata or resolve_summary_metadata(model=model, ai_engine=ai_engine)
    prompt = build_summary_prompt(transcript_text, title)
    return run_prompt(prompt, metadata)


def build_summary_md(
    summary_text: str,
    title: str,
    video_id: str,
    ai_engine: str | None = None,
    model: str | None = None,
    generated_at: str | None = None,
) -> str:
    """Build the persisted summary markdown without duplicate display metadata."""
    return strip_summary_header(summary_text)


def strip_summary_header(summary_text: str) -> str:
    """Remove the generated summary title/metadata block from markdown."""
    original = summary_text.strip()
    lines = original.splitlines()
    if lines and lines[0].startswith("# "):
        lines = lines[1:]
        if not any(line.strip() for line in lines):
            return original + "\n"

    while lines and not lines[0].strip():
        lines = lines[1:]

    metadata_prefixes = (
        "**URL**:",
        "**Generated**:",
        "**AI Engine**:",
        "**Model**:",
    )
    while lines and lines[0].startswith(metadata_prefixes):
        lines = lines[1:]

    while lines and not lines[0].strip():
        lines = lines[1:]

    if lines and lines[0].strip() == "---":
        lines = lines[1:]
        while lines and not lines[0].strip():
            lines = lines[1:]

    return "\n".join(lines).strip() + "\n"


def save_summary(
    folder: Path,
    summary_text: str,
    title: str,
    video_id: str,
    ai_engine: str | None = None,
    model: str | None = None,
):
    generated_at = datetime.now().astimezone().isoformat(timespec="seconds")
    content = build_summary_md(
        summary_text,
        title,
        video_id,
        ai_engine,
        model,
        generated_at,
    )
    (folder / "summary.md").write_text(content, encoding="utf-8")
    update_video_metadata(
        folder,
        {
            "aiEngine": ai_engine,
            "model": model,
            "summaryGeneratedAt": generated_at,
        },
    )


def save_brief_summary(
    folder: Path,
    brief_summary_text: str,
    ai_engine: str | None = None,
    model: str | None = None,
):
    generated_at = datetime.now().astimezone().isoformat(timespec="seconds")
    (folder / "brief_summary.md").write_text(
        brief_summary_text.strip() + "\n",
        encoding="utf-8",
    )
    update_video_metadata(
        folder,
        {
            "aiEngine": ai_engine,
            "model": model,
            "briefSummaryGeneratedAt": generated_at,
        },
    )
