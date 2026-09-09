from __future__ import annotations

import asyncio
from pathlib import Path
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from starlette.datastructures import UploadFile

from server.ai.app.factory import create_app
from server.ai.app.upload import BoundedMultipartParser
from server.ai.tests.support import (
    FakeLlmProvider,
    FakeSttProvider,
    FakeVerifier,
    VALID_M4A,
    auth_headers,
    test_settings,
)


VALID_EVENTS = {
    "events": [
        {
            "category": "식사",
            "time": "15:00",
            "type": "분유",
            "amount": 120,
            "note": None,
        }
    ]
}


class TranscribeTests(unittest.TestCase):
    def client(self, stt=None, llm=None, **overrides) -> TestClient:
        app = create_app(
            settings=test_settings(**overrides),
            verifier=FakeVerifier(),
            llm_provider=llm or FakeLlmProvider(VALID_EVENTS),
            stt_provider=stt or FakeSttProvider(),
        )
        return TestClient(app, raise_server_exceptions=False)

    def test_unauthenticated_upload_is_rejected(self) -> None:
        response = self.client().post(
            "/v1/transcribe", files={"file": ("recording.m4a", VALID_M4A, "audio/m4a")}
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "AUTH_REQUIRED")

    def test_unsupported_mime_is_rejected(self) -> None:
        response = self.client().post(
            "/v1/transcribe",
            files={"file": ("recording.bin", VALID_M4A, "application/octet-stream")},
            headers=auth_headers(),
        )
        self.assertEqual(response.status_code, 415)
        self.assertEqual(response.json()["error"]["code"], "UNSUPPORTED_AUDIO_TYPE")

    def test_declared_mime_must_match_signature(self) -> None:
        response = self.client().post(
            "/v1/transcribe",
            files={"file": ("recording.m4a", b"not-an-m4a", "audio/m4a")},
            headers=auth_headers(),
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "INVALID_AUDIO")

    def test_oversized_audio_is_rejected(self) -> None:
        response = self.client(max_audio_bytes=20).post(
            "/v1/transcribe",
            files={"file": ("recording.m4a", VALID_M4A + b"x" * 20, "audio/m4a")},
            headers=auth_headers(),
        )
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json()["error"]["code"], "REQUEST_TOO_LARGE")

    def test_success_returns_compatible_event_shape(self) -> None:
        stt = FakeSttProvider()
        response = self.client(stt=stt).post(
            "/v1/transcribe",
            files={"file": ("attacker-name.exe", VALID_M4A, "audio/m4a")},
            headers=auth_headers(),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["raw_text"], "15:00 분유 120ml")
        self.assertEqual(response.json()["events"][0]["category"], "식사")
        self.assertEqual(stt.requests[0].filename, "recording.m4a")

    def test_stt_timeout_is_sanitized(self) -> None:
        response = self.client(stt=FakeSttProvider(asyncio.TimeoutError())).post(
            "/v1/transcribe",
            files={"file": ("recording.m4a", VALID_M4A, "audio/m4a")},
            headers=auth_headers(),
        )
        self.assertEqual(response.status_code, 504)
        self.assertEqual(response.json()["error"]["code"], "PROVIDER_TIMEOUT")

    def test_success_closes_upload(self) -> None:
        handles = []
        original = BoundedMultipartParser.on_headers_finished
        def capture(parser):
            original(parser)
            handles.extend(parser.owned_files)
        with patch.object(BoundedMultipartParser, "on_headers_finished", capture):
            response = self.client().post(
                "/v1/transcribe",
                files={"file": ("recording.m4a", VALID_M4A, "audio/m4a")},
                headers=auth_headers(),
            )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(handles)
        self.assertTrue(all(handle.closed for handle in handles))

    def test_failure_closes_upload(self) -> None:
        handles = []
        original = BoundedMultipartParser.on_headers_finished
        def capture(parser):
            original(parser)
            handles.extend(parser.owned_files)
        with patch.object(BoundedMultipartParser, "on_headers_finished", capture):
            response = self.client(stt=FakeSttProvider(RuntimeError("provider detail"))).post(
                "/v1/transcribe",
                files={"file": ("recording.m4a", VALID_M4A, "audio/m4a")},
                headers=auth_headers(),
            )
        self.assertEqual(response.status_code, 502)
        self.assertTrue(handles)
        self.assertTrue(all(handle.closed for handle in handles))
        self.assertNotIn("provider detail", response.text)

    def test_event_numbers_must_come_from_transcript(self) -> None:
        llm = FakeLlmProvider(
            {"events": [{"category": "식사", "time": "15:00", "amount": 999}]}
        )
        response = self.client(llm=llm).post(
            "/v1/transcribe",
            files={"file": ("recording.m4a", VALID_M4A, "audio/m4a")},
            headers=auth_headers(),
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "OUTPUT_REJECTED")

    def test_event_category_must_be_grounded_in_transcript(self) -> None:
        llm = FakeLlmProvider(
            {"events": [{"category": "목욕", "time": "15:00", "note": None}]}
        )
        response = self.client(llm=llm).post(
            "/v1/transcribe",
            files={"file": ("recording.m4a", VALID_M4A, "audio/m4a")},
            headers=auth_headers(),
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "OUTPUT_REJECTED")

    def test_event_text_fields_must_be_grounded_in_transcript(self) -> None:
        llm = FakeLlmProvider(
            {
                "events": [
                    {
                        "category": "식사",
                        "time": "15:00",
                        "type": "분유",
                        "amount": 120,
                        "note": "잘 먹고 만족해 보였음",
                    }
                ]
            }
        )
        response = self.client(llm=llm).post(
            "/v1/transcribe",
            files={"file": ("recording.m4a", VALID_M4A, "audio/m4a")},
            headers=auth_headers(),
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "OUTPUT_REJECTED")

    def test_no_insecure_tls_patterns_in_application(self) -> None:
        app_root = Path(__file__).resolve().parents[1] / "app"
        source = "\n".join(path.read_text() for path in app_root.rglob("*.py"))
        banned = ("verify" + "=False", "CERT" + "_NONE", "check_hostname" + "=False")
        for pattern in banned:
            self.assertNotIn(pattern, source)


if __name__ == "__main__":
    unittest.main()
