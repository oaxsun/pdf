# Oaxsun PDF Compressor v0.1 (API + Worker + Simple UI)

A minimal, production-minded starter to compress PDFs (max upload: **200 MiB**) using:
- FastAPI (API)
- Redis + RQ (job queue)
- Ghostscript (compression)
- qpdf (optional pre-optimization)
- Simple `index.html` UI (upload + progress + download)

## Quick start (Docker)
```bash
docker compose up --build
```

Open UI:
- http://localhost:8000/

API health:
- http://localhost:8000/health

## Endpoints
- `POST /pdf/compress` (multipart: `file`, `level=high|medium|low`) -> `{ job_id }`
- `GET /jobs/{job_id}` -> status + sizes + ratio + error
- `GET /jobs/{job_id}/download` -> download when done

## Notes
- Upload limit is enforced both by `Content-Length` (when present) and by streaming read limit.
- Files are stored in `/data` inside containers (bind-mounted to `./data` on host).
- Results are kept for `JOB_TTL_SECONDS` (default 6 hours). A small cleanup runs on worker startup and periodically during jobs.

## Local dev (without Docker)
Requires: Redis, Ghostscript (`gs`), qpdf.
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export REDIS_URL=redis://localhost:6379/0
uvicorn api.main:app --reload --port 8000
python worker/worker.py
```
