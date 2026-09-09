from __future__ import annotations

from dataclasses import dataclass

from fastapi import UploadFile

from .errors import AppError


_MIME_EXTENSIONS = {
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/mp4": "mp4",
    "audio/wav": "wav",
    "audio/mpeg": "mp3",
    "audio/webm": "webm",
}


@dataclass(frozen=True, slots=True)
class ValidatedAudio:
    data: bytes
    content_type: str
    safe_filename: str


def _signature_matches(content_type: str, data: bytes) -> bool:
    if content_type in {"audio/m4a", "audio/x-m4a", "audio/mp4"}:
        return len(data) >= 12 and data[4:8] == b"ftyp"
    if content_type == "audio/wav":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE"
    if content_type == "audio/mpeg":
        return data.startswith(b"ID3") or (len(data) >= 2 and data[0] == 0xFF and data[1] & 0xE0 == 0xE0)
    if content_type == "audio/webm":
        return data.startswith(b"\x1aE\xdf\xa3")
    return False


async def read_validated_audio(file: UploadFile, max_bytes: int) -> ValidatedAudio:
    content_type = (file.content_type or "").lower().split(";", 1)[0].strip()
    extension = _MIME_EXTENSIONS.get(content_type)
    if extension is None:
        raise AppError("UNSUPPORTED_AUDIO_TYPE", 415, "The audio type is not supported.")

    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise AppError("REQUEST_TOO_LARGE", 413, "The audio file is too large.")
        chunks.append(chunk)
    data = b"".join(chunks)
    if not data or not _signature_matches(content_type, data):
        raise AppError("INVALID_AUDIO", 422, "The uploaded file is not valid audio for its declared type.")
    return ValidatedAudio(
        data=data,
        content_type=content_type,
        safe_filename=f"recording.{extension}",
    )
