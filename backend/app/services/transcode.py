import json
import os
import subprocess
import tempfile

from app.services import storage


def _run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, capture_output=True)


def probe(path: str) -> dict:
    """Return duration, width, height via ffprobe."""
    out = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-show_entries", "format=duration",
            "-of", "json", path,
        ],
        check=True, capture_output=True, text=True,
    ).stdout
    data = json.loads(out)
    stream = (data.get("streams") or [{}])[0]
    duration = float(data.get("format", {}).get("duration", 0) or 0)
    return {
        "width": int(stream.get("width", 0) or 0),
        "height": int(stream.get("height", 0) or 0),
        "duration": int(round(duration)),
    }


def resolution_label(height: int) -> str:
    if height >= 2160:
        return "4K"
    if height >= 1440:
        return "2K"
    if height >= 1080:
        return "1080p"
    if height >= 720:
        return "720p"
    if height >= 480:
        return "480p"
    return f"{height}p" if height else "SD"

def aspect_ratio_label(width: int, height: int) -> str:
    if not width or not height:
        return ""
    from math import gcd
    ratio = width / height
    # Gyakori arányok felismerése kis tűréssel
    common = {
        16 / 9: "16:9",
        9 / 16: "9:16",
        1 / 1: "1:1",
        4 / 3: "4:3",
        3 / 4: "3:4",
        21 / 9: "21:9",
        4 / 5: "4:5",
    }
    for value, label in common.items():
        if abs(ratio - value) < 0.04:
            return label
    # Ha nem gyakori, számoljuk ki a legegyszerűbb formát
    d = gcd(width, height)
    return f"{width // d}:{height // d}"


def make_thumbnail(src: str, out_jpg: str, at_second: float = 1.0) -> None:
    _run([
        "ffmpeg", "-y", "-ss", str(at_second), "-i", src,
        "-frames:v", "1", "-vf", "scale=1280:-2",
        "-q:v", "3", out_jpg,
    ])


def make_hls(src: str, out_dir: str) -> str:
    """Generate adaptive HLS. Returns master playlist filename."""
    os.makedirs(out_dir, exist_ok=True)
    master = os.path.join(out_dir, "master.m3u8")
    # Single-rendition HLS (extend with -var_stream_map for ABR)
    _run([
        "ffmpeg", "-y", "-i", src,
        "-c:v", "libx264", "-c:a", "aac",
        "-profile:v", "main", "-crf", "20", "-sc_threshold", "0",
        "-g", "48", "-keyint_min", "48",
        "-hls_time", "6", "-hls_playlist_type", "vod",
        "-hls_segment_filename", os.path.join(out_dir, "seg_%03d.ts"),
        master,
    ])
    return master


def process_video(src_path: str, key_prefix: str) -> dict:
    """
    Full pipeline: probe -> thumbnail -> HLS -> upload all to R2.
    key_prefix e.g. 'videos/<video_id>'
    Returns dict of urls + metadata.
    """
    meta = probe(src_path)

    with tempfile.TemporaryDirectory() as tmp:
        # Thumbnail
        thumb = os.path.join(tmp, "thumb.jpg")
        make_thumbnail(src_path, thumb, at_second=min(1.0, meta["duration"] / 2 or 1))
        thumb_url = storage.upload_file(
            thumb, f"{key_prefix}/thumbnail.jpg", "image/jpeg"
        )

        # HLS
        hls_dir = os.path.join(tmp, "hls")
        make_hls(src_path, hls_dir)
        hls_url = ""
        for fname in os.listdir(hls_dir):
            fpath = os.path.join(hls_dir, fname)
            ctype = (
                "application/vnd.apple.mpegurl"
                if fname.endswith(".m3u8")
                else "video/mp2t"
            )
            url = storage.upload_file(fpath, f"{key_prefix}/hls/{fname}", ctype)
            if fname == "master.m3u8":
                hls_url = url

        # Original MP4 (for direct download)
        mp4_url = storage.upload_file(
            src_path, f"{key_prefix}/source.mp4", "video/mp4"
        )
        size_bytes = os.path.getsize(src_path)

    return {
        "thumbnail_url": thumb_url,
        "hls_url": hls_url,
        "mp4_url": mp4_url,
        "source_key": f"{key_prefix}/source.mp4",
        "duration_seconds": meta["duration"],
        "width": meta["width"],
        "height": meta["height"],
        "resolution_label": resolution_label(meta["height"]),
        "size_bytes": size_bytes,
    }
