import json
import os
import shutil
import subprocess
import time
from pathlib import Path

def _run(cmd: list[str], timeout_s: int = 600) -> None:
    # Capture stderr for debugging but keep output quiet unless error
    proc = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout_s,
        check=False,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Command failed ({proc.returncode}): {' '.join(cmd)}\n{proc.stderr.strip()}")

def _gs_settings(level: str) -> str:
    # Ghostscript presets:
    # /prepress (highest), /ebook (balanced), /screen (smallest)
    if level == "high":
        return "/prepress"
    if level == "low":
        return "/screen"
    return "/ebook"

def _cleanup_old(data_dir: Path, ttl_seconds: int) -> None:
    now = time.time()
    for sub in ("in", "out", "meta"):
        p = data_dir / sub
        if not p.exists():
            continue
        for f in p.glob("*"):
            try:
                if f.is_file() and (now - f.stat().st_mtime) > ttl_seconds:
                    f.unlink(missing_ok=True)
            except Exception:
                pass

def compress_pdf_job(job_id: str, level: str, in_path: str, out_path: str, meta_path: str, ttl_seconds: int):
    data_dir = Path(meta_path).resolve().parents[1]  # /data
    _cleanup_old(data_dir, ttl_seconds)

    mp = Path(meta_path)
    meta = json.loads(mp.read_text(encoding="utf-8"))
    meta["status"] = "processing"
    mp.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    in_p = Path(in_path)
    out_p = Path(out_path)
    tmp_dir = out_p.parent / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    # Step 1: optional qpdf linearize/cleanup into temp
    pre_p = tmp_dir / f"{job_id}.pre.pdf"
    try:
        _run(["qpdf", "--linearize", str(in_p), str(pre_p)], timeout_s=240)
        src = pre_p
    except Exception:
        # If qpdf fails, continue with original
        src = in_p

    # Step 2: ghostscript compress
    gs_setting = _gs_settings(level)
    try:
        _run([
            "gs",
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            f"-dPDFSETTINGS={gs_setting}",
            "-dNOPAUSE", "-dQUIET", "-dBATCH",
            f"-sOutputFile={str(out_p)}",
            str(src),
        ], timeout_s=600)
    except Exception as e:
        meta["status"] = "failed"
        meta["error"] = str(e)
        mp.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        raise

    # Stats
    try:
        input_bytes = int(in_p.stat().st_size)
        output_bytes = int(out_p.stat().st_size)
        ratio = (output_bytes / input_bytes) if input_bytes else None
    except Exception:
        input_bytes, output_bytes, ratio = meta.get("input_bytes"), None, None

    meta["status"] = "done"
    meta["output_bytes"] = output_bytes
    meta["ratio"] = ratio
    meta["error"] = None
    mp.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    # best-effort cleanup temp
    try:
        if pre_p.exists():
            pre_p.unlink(missing_ok=True)
    except Exception:
        pass
    _cleanup_old(data_dir, ttl_seconds)
    return {"output_bytes": output_bytes, "ratio": ratio}
