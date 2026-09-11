"""Synthetic-only media; no credentials, provider requests or user recordings."""
from __future__ import annotations

import io
from pathlib import Path
import shutil
import subprocess
import wave


def wav(frames=65520, channels=1, rate=16000) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as writer:
        writer.setnchannels(channels)
        writer.setsampwidth(2)
        writer.setframerate(rate)
        writer.writeframes(b"\0\0" * frames * channels)
    return buffer.getvalue()


def compressed(directory: str) -> dict[str, bytes]:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("P1.3 requires runtime ffmpeg; skipping is not allowed")
    result = {}
    for name, seconds, extra in [
        ("valid", "4.095", []), ("vbr", "1", ["-q:a", "2"]),
        ("long", "1800", ["-b:a", "8k"]),
        ("two_audio", "1", ["-map", "0:a", "-map", "0:a"]),
        ("video", "1", ["-f", "lavfi", "-i", "color=size=16x16:rate=1",
                            "-map", "0:a", "-map", "1:v", "-c:v", "mpeg4"]),
        ("cover", "1", ["-f", "lavfi", "-i", "color=size=16x16:rate=1",
                            "-map", "0:a", "-map", "1:v", "-c:v", "mjpeg",
                            "-frames:v", "1", "-disposition:v", "attached_pic"]),
    ]:
        path = Path(directory) / (name + ".m4a")
        args = [ffmpeg, "-v", "error", "-nostdin", "-y", "-f", "lavfi", "-i",
                "sine=frequency=440:sample_rate=16000", *extra, "-t", seconds,
                "-c:a", "aac", "-threads", "1", "-filter_threads", "1",
                "-movflags", "+faststart", str(path)]
        # All arguments are constant synthetic test data, never user-controlled.
        completed = subprocess.run(args, capture_output=True, timeout=60)
        if completed.returncode:
            raise AssertionError(f"synthetic fixture encoder failed: {name}")
        result[name] = path.read_bytes()
    return result
