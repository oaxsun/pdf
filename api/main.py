import os
import uuid
import math
from pathlib import Path
from typing import Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

from redis import Redis
from rq import Queue
from rq.job import Job

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(200 * 1024 * 1024)))  # 200 MiB default
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
DATA_DIR = Path(os.getenv("DATA_DIR", "./data")).resolve()
JOB_TTL_SECONDS = int(os.getenv("JOB_TTL_SECONDS", "21600"))  # 6 hours

IN_DIR = DATA_DIR / "in"
OUT_DIR = DATA_DIR / "out"
META_DIR = DATA_DIR / "meta"
for d in (IN_DIR, OUT_DIR, META_DIR):
    d.mkdir(parents=True, exist_ok=True)

redis_conn = Redis.from_url(REDIS_URL)
q = Queue("pdf", connection=redis_conn, default_timeout=60 * 10)  # 10 min default timeout

app = FastAPI(title="Oaxsun PDF Compressor", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

@app.get("/", response_class=HTMLResponse)
def index():
    # Serve bundled UI
    ui_path = Path(__file__).resolve().parent.parent / "ui" / "index.html"
    return HTMLResponse(ui_path.read_text(encoding="utf-8"))

@app.get("/health")
def health():
    return {"ok": True}

def _safe_level(level: str) -> str:
    level = (level or "medium").lower().strip()
    if level not in ("high", "medium", "low"):
        raise HTTPException(status_code=400, detail="Invalid level. Use: high|medium|low")
    return level

async def _save_upload_limited(upload: UploadFile, dst: Path, max_bytes: int) -> int:
    # Enforce by reading stream, even if Content-Length missing.
    written = 0
    with dst.open("wb") as f:
        while True:
            chunk = await upload.read(1024 * 1024)  # 1 MiB
            if not chunk:
                break
            written += len(chunk)
            if written > max_bytes:
                # Remove partial file and abort
                try:
                    f.close()
                except Exception:
                    pass
                try:
                    dst.unlink(missing_ok=True)
                except Exception:
                    pass
                raise HTTPException(status_code=413, detail=f"File too large. Max is {max_bytes} bytes.")
            f.write(chunk)
    return written

@app.post("/pdf/compress")
async def compress_pdf(
    file: UploadFile = File(...),
    level: str = Form("medium"),
):
    # Fast check via Content-Length when present (saves time)
    # Starlette doesn't always expose it, so we rely on streaming limit regardless.
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only .pdf files are supported")

    level = _safe_level(level)
    job_id = str(uuid.uuid4())

    in_path = IN_DIR / f"{job_id}.pdf"
    out_path = OUT_DIR / f"{job_id}.pdf"
    meta_path = META_DIR / f"{job_id}.json"

    input_bytes = await _save_upload_limited(file, in_path, MAX_UPLOAD_BYTES)

    meta = {
        "job_id": job_id,
        "status": "queued",
        "level": level,
        "input_path": str(in_path),
        "output_path": str(out_path),
        "input_bytes": input_bytes,
        "output_bytes": None,
        "ratio": None,
        "error": None,
    }
    meta_path.write_text(__import__("json").dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    # Enqueue
    job = q.enqueue(
        "worker.tasks.compress_pdf_job",
        job_id,
        level,
        str(in_path),
        str(out_path),
        str(meta_path),
        JOB_TTL_SECONDS,
        result_ttl=JOB_TTL_SECONDS,
        ttl=JOB_TTL_SECONDS,
        failure_ttl=JOB_TTL_SECONDS,
    )

    return {"job_id": job_id}

@app.get("/jobs/{job_id}")
def job_status(job_id: str):
    meta_path = META_DIR / f"{job_id}.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Job not found")
    meta = __import__("json").loads(meta_path.read_text(encoding="utf-8"))
    return meta

@app.get("/jobs/{job_id}/download")
def download(job_id: str):
    meta_path = META_DIR / f"{job_id}.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Job not found")
    meta = __import__("json").loads(meta_path.read_text(encoding="utf-8"))
    if meta.get("status") != "done":
        raise HTTPException(status_code=409, detail="Job not finished")
    out_path = Path(meta["output_path"])
    if not out_path.exists():
        raise HTTPException(status_code=404, detail="Output missing")
    return FileResponse(
        path=str(out_path),
        media_type="application/pdf",
        filename=f"compressed-{job_id}.pdf",
    )
