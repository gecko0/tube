import shutil
import subprocess
from datetime import datetime
from pathlib import Path

from .config import CLAUDE_MODEL
from .cloud import load_config


def summarize(transcript_text: str, title: str, model: str | None = None) -> str:
    """Call claude to summarize a transcript. Returns the summary text."""
    if not shutil.which("claude"):
        raise FileNotFoundError(
            "claude CLI not found. Install Claude Code and run `claude login`.\n"
            "See: https://docs.anthropic.com/en/docs/claude-code"
        )

    prompt = f"""You are an expert content analyst. Your job is to distill a YouTube video transcript into a dense, actionable reference document. The reader is busy — they want the gold, not the fluff.

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

    result = subprocess.run(
        [
            "claude",
            "--model",
            model or load_config().get("model", CLAUDE_MODEL),
            "-p",
            prompt,
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def build_summary_md(summary_text: str, title: str, video_id: str) -> str:
    url = f"https://youtube.com/watch?v={video_id}"
    today = datetime.now().astimezone().isoformat(timespec="seconds")

    header = (
        f"**URL**: {url}\n"
        f"**Generated**: {today}\n"
        f"\n"
        f"---\n\n"
    )

    # The prompt produces a full markdown doc starting with "# title".
    # Insert the metadata right after the first heading line.
    lines = summary_text.split("\n", 1)
    if len(lines) == 2:
        return f"{lines[0]}\n\n{header}{lines[1]}\n"
    return f"{summary_text}\n\n{header}"


def save_summary(folder: Path, summary_text: str, title: str, video_id: str):
    content = build_summary_md(summary_text, title, video_id)
    (folder / "summary.md").write_text(content, encoding="utf-8")
