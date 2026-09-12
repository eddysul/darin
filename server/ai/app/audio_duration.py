"""Strict, bounded media verification; the proof covers exactly the STT WAV.

Container duration tags are never a billing proof. WAV framing is audited then
read with stdlib wave. AAC-LC is fully decoded by bounded FFmpeg workers. Both
paths emit a plain PCM WAV, eliminating provider/container stream ambiguity.
"""
from __future__ import annotations

import asyncio
import hashlib
import io
import json
import math
import os
from pathlib import Path
import shutil
import signal
import struct
import sys
import tempfile
import threading
import wave
from dataclasses import dataclass

from .audio import ValidatedAudio
from .errors import AppError
from .quota.pricing import VerifiedAudioDuration
from .telemetry import METRICS


MAX_AUDIO_SECONDS = 120
MAX_INPUT_BYTES = 24 * 1024 * 1024
SAMPLE_RATES = frozenset({8000, 16000, 22050, 24000, 32000, 44100, 48000})
DECODE_RATE = 16000
WORKER_TIMEOUT_SECONDS = 10
PROBE_BYTES = 64 * 1024
STDERR_BYTES = 8 * 1024
_WORKER_SLOTS = threading.BoundedSemaphore(2)
_WORKER = str(Path(__file__).with_name("media_worker.py"))


def rejected(code: str = "AUDIO_DURATION_UNVERIFIED", status: int = 422) -> AppError:
    # No parser diagnostics, paths, filenames or audio content cross this boundary.
    METRICS.add({"AUDIO_FORMAT_UNSUPPORTED": "duration_format",
                 "AUDIO_METADATA_INVALID": "duration_metadata",
                 "AUDIO_TOO_LONG": "duration_too_long"}.get(code, "duration_unverified"))
    return AppError(code, status, "The audio could not be safely verified.")


@dataclass(frozen=True, slots=True)
class VerifiedMedia:
    audio: ValidatedAudio
    duration: VerifiedAudioDuration


def _canonical(pcm: bytes, channels: int, rate: int, method: str) -> VerifiedMedia:
    if not pcm or len(pcm) % (channels * 2):
        raise rejected()
    frames = len(pcm) // (channels * 2)
    if frames > MAX_AUDIO_SECONDS * rate:
        raise rejected("AUDIO_TOO_LONG", 413)
    output = io.BytesIO()
    with wave.open(output, "wb") as writer:
        writer.setnchannels(channels)
        writer.setsampwidth(2)
        writer.setframerate(rate)
        writer.writeframes(pcm)
    data = output.getvalue()
    return VerifiedMedia(
        ValidatedAudio(data, "audio/wav", "recording.wav"),
        VerifiedAudioDuration(hashlib.sha256(data).hexdigest(),
            (frames * 1000 + rate - 1) // rate, "verified-duration.v1",
            frames, rate, method),
    )


def _wav(data: bytes) -> VerifiedMedia:
    # wave alone tolerates truncated RIFF/data declarations and ignores trailing
    # chunks. Audit ONLY chunk envelopes and PCM framing before using that parser.
    if len(data) < 44 or data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        raise rejected("AUDIO_METADATA_INVALID")
    if int.from_bytes(data[4:8], "little") != len(data) - 8:
        raise rejected("AUDIO_METADATA_INVALID")
    chunks: dict[bytes, bytes] = {}
    offset, count = 12, 0
    while offset < len(data):
        count += 1
        if count > 128 or offset + 8 > len(data):
            raise rejected("AUDIO_METADATA_INVALID")
        name, size = struct.unpack_from("<4sI", data, offset)
        start, end = offset + 8, offset + 8 + size
        if end + size % 2 > len(data):
            raise rejected("AUDIO_METADATA_INVALID")
        if name in {b"fmt ", b"data"}:
            if name in chunks:
                raise rejected("AUDIO_METADATA_INVALID")
            chunks[name] = data[start:end]
        elif name not in {b"JUNK", b"LIST", b"bext", b"PAD "}:
            # No wavl playlists, cue/edit interpretation, compressed/fact chunks.
            raise rejected("AUDIO_FORMAT_UNSUPPORTED", 415)
        offset = end + size % 2
    fmt, pcm = chunks.get(b"fmt ", b""), chunks.get(b"data", b"")
    if len(fmt) != 16:
        raise rejected("AUDIO_FORMAT_UNSUPPORTED", 415)
    encoding, channels, rate, byte_rate, align, bits = struct.unpack("<HHIIHH", fmt)
    if encoding != 1 or channels not in {1, 2} or bits != 16 or rate not in SAMPLE_RATES:
        raise rejected("AUDIO_FORMAT_UNSUPPORTED", 415)
    if align != channels * 2 or byte_rate != rate * align or len(pcm) % align:
        raise rejected("AUDIO_METADATA_INVALID")
    try:
        with wave.open(io.BytesIO(data), "rb") as reader:
            frames = reader.getnframes()
            if frames * align != len(pcm) or reader.readframes(frames + 1) != pcm:
                raise rejected("AUDIO_METADATA_INVALID")
    except (wave.Error, EOFError, ValueError) as exc:
        raise rejected("AUDIO_METADATA_INVALID") from exc
    return _canonical(pcm, channels, rate, "pcm-frames.v1")


async def _capture(stream: asyncio.StreamReader, limit: int, code: str) -> bytes:
    result = bytearray()
    while True:
        chunk = await stream.read(min(64 * 1024, limit + 1 - len(result)))
        if not chunk:
            return bytes(result)
        result.extend(chunk)
        if len(result) > limit:
            raise rejected(code, 413 if code == "AUDIO_TOO_LONG" else 422)


async def _discard(stream: asyncio.StreamReader) -> None:
    # Called only after SIGKILL: drain bounded OS/asyncio pipe buffers without
    # retaining diagnostics. A paused pipe otherwise prevents transport cleanup.
    while await stream.read(64 * 1024):
        pass


async def _run(tool: str, args: list[str], output_limit: int,
               overflow_code: str = "AUDIO_DURATION_UNVERIFIED") -> bytes:
    executable = shutil.which(tool)
    if executable is None:
        raise rejected("COST_BOUND_UNAVAILABLE", 503)
    proc = None
    tasks: list[asyncio.Task] = []
    completion = None
    try:
        # Empty environment: provider credentials cannot reach the media process.
        proc = await asyncio.create_subprocess_exec(
            sys.executable, "-I", _WORKER, executable, *args,
            stdin=asyncio.subprocess.DEVNULL, stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE, start_new_session=True,
            env={"LC_ALL": "C", "PATH": os.defpath,
                 "OPENBLAS_NUM_THREADS": "1", "OMP_NUM_THREADS": "1"},
        )
        METRICS.add("child_started")
        METRICS.add("children_active")
        tasks = [asyncio.create_task(_capture(proc.stdout, output_limit, overflow_code)),
                 asyncio.create_task(_capture(proc.stderr, STDERR_BYTES, "AUDIO_DURATION_UNVERIFIED")),
                 asyncio.create_task(proc.wait())]
        completion = asyncio.gather(*tasks)
        stdout, stderr, code = await asyncio.wait_for(completion, WORKER_TIMEOUT_SECONDS)
        if code != 0 or stderr:
            raise rejected()
        return stdout
    except (OSError, asyncio.TimeoutError) as exc:
        raise rejected() from exc
    finally:
        async def cleanup():
            if proc is not None:
                # Always reap, including cancellation, parser failure and pipe overflow.
                if proc.returncode is None:
                    try:
                        os.killpg(proc.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
            for task in tasks:
                if not task.done():
                    task.cancel()
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
            if completion is not None:
                await asyncio.gather(completion, return_exceptions=True)
            if proc is not None:
                await asyncio.gather(_discard(proc.stdout), _discard(proc.stderr), proc.wait())

        cleanup_task = asyncio.create_task(cleanup())
        cancelled = False
        while not cleanup_task.done():
            try:
                await asyncio.shield(cleanup_task)
            except asyncio.CancelledError:
                # A second disconnect/shutdown cancellation must not abandon reaping.
                cancelled = True
        cleanup_task.result()
        if proc is not None:
            METRICS.add("children_active", -1)
            METRICS.add("child_reaped")
        if cancelled:
            raise asyncio.CancelledError()


def _stream_info(raw: bytes) -> tuple[int, int]:
    try:
        obj = json.loads(raw)
        streams = obj["streams"]
        if not isinstance(streams, list) or len(streams) != 1:
            raise ValueError()
        stream = streams[0]
        if (stream["codec_type"] != "audio" or stream["codec_name"] != "aac"
                or stream["profile"] != "LC" or stream["channels"] not in {1, 2}):
            raise ValueError()
        rate = int(stream["sample_rate"])
        if rate not in SAMPLE_RATES:
            raise ValueError()
        # Sanity only, never used to calculate the proof/price or bound decoding.
        duration = float(stream["duration"])
        if not math.isfinite(duration) or duration <= 0:
            raise ValueError()
        return stream["channels"], rate
    except (KeyError, ValueError, TypeError, OverflowError, RecursionError) as exc:
        raise rejected("AUDIO_METADATA_INVALID") from exc


def _local_bmff(data: bytes) -> None:
    """Bounded box-envelope/dref audit only; FFmpeg still parses/decodes media.

    Disabling MOV drefs prevents fetches but can silently ignore an external
    reference. Reject those declarations too, before invoking either tool.
    Fragmented/playlist-like layouts are outside this intentionally small subset.
    """
    count, references, tracks = 0, 0, 0
    containers = {b"moov", b"trak", b"mdia", b"minf", b"dinf"}

    def boxes(start: int, end: int, depth: int = 0):
        nonlocal count, references, tracks
        if depth > 6:
            raise rejected("AUDIO_METADATA_INVALID")
        names = []
        while start < end:
            count += 1
            if count > 4096 or start + 8 > end:
                raise rejected("AUDIO_METADATA_INVALID")
            size, kind = struct.unpack_from(">I4s", data, start)
            header = 8
            if size == 1:
                if start + 16 > end:
                    raise rejected("AUDIO_METADATA_INVALID")
                size = struct.unpack_from(">Q", data, start + 8)[0]
                header = 16
            if size < header or start + size > end:
                raise rejected("AUDIO_METADATA_INVALID")
            body, stop = start + header, start + size
            names.append(kind)
            if kind == b"trak":
                tracks += 1
            if kind in containers:
                boxes(body, stop, depth + 1)
            elif kind == b"dref":
                references += 1
                # FullBox version/flags=0, entry_count=1, self-contained url.
                if data[body:stop] != b"\0\0\0\0\0\0\0\1\0\0\0\x0curl \0\0\0\1":
                    raise rejected("AUDIO_FORMAT_UNSUPPORTED", 415)
            if depth == 0 and kind not in {b"ftyp", b"moov", b"mdat", b"free", b"skip"}:
                raise rejected("AUDIO_FORMAT_UNSUPPORTED", 415)
            start = stop
        return names

    top = boxes(0, len(data))
    if (top.count(b"ftyp") != 1 or top.count(b"moov") != 1 or top.count(b"mdat") != 1
            or references != 1 or tracks != 1):
        raise rejected("AUDIO_METADATA_INVALID")


class AudioDurationVerifier:
    async def __call__(self, audio: ValidatedAudio) -> VerifiedMedia:
        try:
            result = await self._verify(audio)
            METRICS.add("duration_verified")
            return result
        except BaseException:
            METRICS.add("duration_rejected")
            raise

    async def _verify(self, audio: ValidatedAudio) -> VerifiedMedia:
        if not _WORKER_SLOTS.acquire(blocking=False):
            raise rejected("AUDIO_VERIFIER_BUSY", 503)
        try:
            if not audio.data or len(audio.data) > MAX_INPUT_BYTES:
                raise rejected("REQUEST_TOO_LARGE", 413)
            if audio.content_type == "audio/wav":
                return _wav(audio.data)
            if audio.content_type not in {"audio/m4a", "audio/x-m4a", "audio/mp4"}:
                raise rejected("AUDIO_FORMAT_UNSUPPORTED", 415)
            _local_bmff(audio.data)
            with tempfile.TemporaryDirectory(prefix="darin-media-") as directory:
                path = Path(directory) / "input.m4a"
                path.write_bytes(audio.data)
                # Fixed local input; never a user filename/URL. MOV external data
                # references are disabled; network/nested demuxers are not allowed.
                inputs = ["-max_alloc", "33554432", "-threads", "1",
                    "-protocol_whitelist", "file", "-format_whitelist", "mov",
                    "-codec_whitelist", "aac", "-f", "mov", "-enable_drefs", "0",
                    "-use_absolute_path", "0", "-err_detect", "explode+careful+compliant",
                    "-i", str(path)]
                probe = await _run("ffprobe", ["-v", "error", *inputs,
                    "-show_entries", "stream=codec_type,codec_name,profile,channels,sample_rate,duration",
                    "-of", "json"], PROBE_BYTES)
                channels, _ = _stream_info(probe)
                pcm = await _run("ffmpeg", ["-v", "error", "-nostdin", "-xerror", *inputs,
                    "-map", "0:0", "-vn", "-sn", "-dn", "-map_metadata", "-1",
                    "-threads", "1", "-filter_threads", "1", "-ac", str(channels),
                    "-ar", str(DECODE_RATE), "-c:a", "pcm_s16le", "-f", "s16le", "pipe:1"],
                    MAX_AUDIO_SECONDS * DECODE_RATE * channels * 2, "AUDIO_TOO_LONG")
                return _canonical(pcm, channels, DECODE_RATE, "aac-full-decode-pcm.v1")
        except OSError as exc:
            raise rejected() from exc
        finally:
            _WORKER_SLOTS.release()
