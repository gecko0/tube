import webbrowser
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import TRANSCRIPTS_DIR
from .storage import find_by_video_id, list_transcripts, read_summary, read_transcript

app = FastAPI()

DIST_DIR = Path(__file__).parent / "web" / "dist"


@app.get("/api/videos")
def api_list_videos():
    transcripts = list_transcripts()
    return [
        {
            "date": t["date"],
            "video_id": t["video_id"],
            "title": t["title"],
            "has_summary": t["has_summary"],
            "thumbnail_url": f"https://img.youtube.com/vi/{t['video_id']}/hqdefault.jpg",
        }
        for t in transcripts
    ]


@app.get("/api/videos/{video_id}")
def api_get_video(video_id: str):
    folder = find_by_video_id(video_id)
    if not folder:
        return JSONResponse(status_code=404, content={"detail": "Video not found"})

    # Parse date and title from folder name
    parts = folder.name.split(" - ", 2)
    date_str = parts[0] if len(parts) >= 1 else ""
    title = parts[2] if len(parts) >= 3 else video_id

    return {
        "date": date_str,
        "video_id": video_id,
        "title": title,
        "summary_md": read_summary(folder),
        "transcript_md": read_transcript(folder),
        "thumbnail_url": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
    }


def _mount_static(application: FastAPI):
    """Mount static files if dist directory exists."""
    if DIST_DIR.exists():
        application.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

        @application.get("/{path:path}")
        def serve_spa(path: str):
            # Try to serve the exact file first
            file_path = DIST_DIR / path
            if path and file_path.exists() and file_path.is_file():
                return FileResponse(file_path)
            # Fall back to index.html for SPA routing
            return FileResponse(DIST_DIR / "index.html")


_mount_static(app)


def run_server(port: int = 8765):
    """Start the web server and open the browser."""
    import uvicorn

    webbrowser.open(f"http://localhost:{port}")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
