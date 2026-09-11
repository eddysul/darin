from __future__ import annotations

import asyncio
from contextlib import ExitStack
from contextvars import ContextVar
import gc
import json
from pathlib import Path
import sys
import tempfile
import time
import tracemalloc
import unittest
from unittest.mock import patch
import weakref

from starlette.datastructures import UploadFile

from server.ai.app import audio_duration as media, factory
from server.ai.app.audio import ValidatedAudio
from server.ai.app.audio_admission import (
    AudioRequestAdmission, BaseExceptionGroup, MAX_CANONICAL_AUDIO_BYTES, PER_REQUEST_AUDIO_RESERVATION_BYTES,
)
from server.ai.app.errors import AppError, output_rejected
from server.ai.app.providers.base import ProviderResult
from server.ai.app.quota.types import Accounting
from server.ai.app.upload import BoundedMultipartParser
from server.ai.tests.audio_fixtures import wav, compressed
from server.ai.tests.quota_fake import service
from server.ai.tests.support import FakeVerifier, FakeLlmProvider, auth_headers, test_settings


_EXCHANGE = ContextVar("audio_test_exchange", default=None)


class AllowRate:
    async def allow(self, *_):
        return True, 0


class NonRetainingStt:
    """Unlike recording fakes, do not retain request.data after provider return."""
    name = "synthetic-local"

    def __init__(self):
        self.entered = 0
        self.block = False
        self.release = asyncio.Event()
        self.error = None

    async def transcribe(self, request):
        self.entered += 1
        exchange = _EXCHANGE.get()
        if exchange:
            exchange.providers += 1
        if self.block:
            await self.release.wait()
        if self.error:
            raise self.error()
        return ProviderResult("15:00 분유 120ml", Accounting(stage_id=request.stage_id,
            pricing_version=request.pricing_version, observed_model=request.model,
            usage_status="KNOWN", billable_duration_ms=4095, parse_status="OK"))


class Exchange:
    """Real ASGI receive, lazily supplied body; no in-process HTTP client copies."""
    def __init__(self, data=None, *, mime="audio/wav", token="valid-token", length=None,
                 interrupted=False, stop_in_body=False):
        self.data = wav() if data is None else data
        self.mime, self.token, self.length = mime, token, length
        self.interrupted, self.stop_in_body = interrupted, stop_in_body
        self.body_wait = asyncio.Event()
        self.consumed = self.parsed = self.written = self.verified = self.workers = 0
        self.materialized = self.providers = 0
        self.handles = []
        self.status, self.messages = None, []

    def chunks(self):
        yield ("--audio\r\nContent-Disposition: form-data; name=\"file\"; filename=\"synthetic\"\r\n"
               f"Content-Type: {self.mime}\r\n\r\n").encode()
        for at in range(0, len(self.data), 65536):
            yield self.data[at:at + 65536]
        if not self.interrupted and not self.stop_in_body:
            yield b"\r\n--audio--\r\n"

    async def run(self, app):
        iterator = iter(self.chunks())
        headers = [(b"content-type", b"multipart/form-data; boundary=audio"),
                   (b"idempotency-key", auth_headers()["Idempotency-Key"].encode())]
        if self.token is not None:
            headers.append((b"authorization", f"Bearer {self.token}".encode()))
        if self.length is not None:
            headers.append((b"content-length", str(self.length).encode()))
        scope = {"type": "http", "asgi": {"version": "3.0", "spec_version": "2.4"},
                 "http_version": "1.1", "method": "POST", "scheme": "http",
                 "path": "/v1/transcribe", "raw_path": b"/v1/transcribe", "query_string": b"",
                 "root_path": "", "headers": headers, "server": ("test", 80), "client": ("test", 123)}
        async def receive():
            await asyncio.sleep(0)
            try:
                chunk = next(iterator)
            except StopIteration:
                if self.stop_in_body:
                    self.body_wait.set()
                    await asyncio.Event().wait()
                if self.interrupted:
                    return {"type": "http.disconnect"}
                return {"type": "http.request", "body": b"", "more_body": False}
            self.consumed += len(chunk)
            return {"type": "http.request", "body": chunk, "more_body": True}
        async def send(message):
            self.messages.append(message)
            if message["type"] == "http.response.start":
                self.status = message["status"]
        token = _EXCHANGE.set(self)
        try:
            await app(scope, receive, send)
        finally:
            _EXCHANGE.reset(token)
        return self

    @property
    def code(self):
        body = b"".join(m.get("body", b"") for m in self.messages)
        return json.loads(body).get("error", {}).get("code")


class Observe(ExitStack):
    def __enter__(self):
        super().__enter__()
        init, headers = BoundedMultipartParser.__init__, BoundedMultipartParser.on_headers_finished
        write, read, verify, run = UploadFile.write, factory.read_validated_audio, media.AudioDurationVerifier.__call__, media._run
        def on_init(obj, *args, **kwargs):
            _EXCHANGE.get().parsed += 1
            init(obj, *args, **kwargs)
        def on_headers(obj):
            headers(obj)
            _EXCHANGE.get().handles.extend(f for f in obj.owned_files if f not in _EXCHANGE.get().handles)
        async def on_write(obj, data):
            _EXCHANGE.get().written += len(data)
            return await write(obj, data)
        async def on_read(*args):
            result = await read(*args)
            _EXCHANGE.get().materialized += len(result.data)
            return result
        async def on_verify(obj, audio):
            _EXCHANGE.get().verified += 1
            return await verify(obj, audio)
        async def on_run(*args):
            _EXCHANGE.get().workers += 1
            return await run(*args)
        for target, name, value in [(BoundedMultipartParser, "__init__", on_init),
                (BoundedMultipartParser, "on_headers_finished", on_headers), (UploadFile, "write", on_write),
                (factory, "read_validated_audio", on_read), (media.AudioDurationVerifier, "__call__", on_verify),
                (media, "_run", on_run)]:
            self.enter_context(patch.object(target, name, value))
        return self


async def until(predicate, timeout=15):
    async def wait():
        while not predicate():
            await asyncio.sleep(.001)
    await asyncio.wait_for(wait(), timeout)


class AdmissionUnitTests(unittest.IsolatedAsyncioTestCase):
    def test_config_and_integer_budget(self):
        self.assertEqual(MAX_CANONICAL_AUDIO_BYTES, 23_040_044)
        for capacity in [0, -1, 3, 10**100, True, 1.5, "2", None]:
            with self.assertRaises(ValueError):
                AudioRequestAdmission(capacity)
        for capacity in [1, 2]:
            self.assertEqual(AudioRequestAdmission(capacity).reserved_bytes,
                             capacity * PER_REQUEST_AUDIO_RESERVATION_BYTES)
        for size in [0, -1, True, 24 * 1024 * 1024 + 1, 10**100]:
            with self.assertRaises(ValueError):
                factory.create_app(settings=test_settings(max_audio_bytes=size))

    async def test_500_cycles_no_queue_leak_or_double_release(self):
        admission = AudioRequestAdmission(1)
        async def inner():
            with self.assertRaises(AppError) as rejected:
                await admission.run(lambda: asyncio.sleep(0))
            self.assertEqual(rejected.exception.code, "AUDIO_CAPACITY_EXCEEDED")
            raise output_rejected()
        for _ in range(500):
            with self.assertRaises(AppError):
                await admission.run(inner)
            self.assertEqual(admission._slots._value, 1)
        self.assertEqual(await admission.run(lambda: asyncio.sleep(0, result="ok")), "ok")

    async def test_errors_and_cancel_drop_payload_refs_before_release_without_gc(self):
        class Payload:
            pass
        for kind in ["success", "cause", "context", "group", "cancel"]:
            admission = AudioRequestAdmission(1)
            refs = []
            async def operation():
                payload = Payload()
                payload.data = bytes(1024 * 1024)
                refs.append(weakref.ref(payload))
                if kind == "success":
                    return "safe"
                try:
                    error = RuntimeError("synthetic")
                    error.payload = payload
                    raise error
                except RuntimeError as original:
                    if kind == "cancel":
                        raise asyncio.CancelledError() from original
                    if kind == "group":
                        raise BaseExceptionGroup("synthetic", [original])
                    if kind == "cause":
                        raise output_rejected() from original
                    raise output_rejected() from None
            release = admission._slots.release
            def checked_release():
                self.assertTrue(refs and all(r() is None for r in refs), kind)
                release()
            was_enabled = gc.isenabled()
            gc.disable()
            try:
                with patch.object(admission._slots, "release", checked_release):
                    if kind == "success":
                        self.assertEqual(await admission.run(operation), "safe")
                    else:
                        with self.assertRaises(BaseException) as result:
                            await admission.run(operation)
                        self.assertIsNone(result.exception.__context__)
            finally:
                if was_enabled:
                    gc.enable()
            self.assertEqual(admission._slots._value, 1)


class AdmissionRouteTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.admission = AudioRequestAdmission()
        self.stt = NonRetainingStt()
        self.llm = FakeLlmProvider(*[{"events": []} for _ in range(100)])
        self.quota = service()
        self.app = factory.create_app(settings=test_settings(), verifier=FakeVerifier(),
            llm_provider=self.llm, stt_provider=self.stt, limiter=AllowRate(),
            quota_service=self.quota, audio_admission=self.admission)
        self.observe = Observe()
        self.observe.__enter__()
        self.addCleanup(self.observe.close)

    def zero_work(self, exchange):
        self.assertEqual((exchange.consumed, exchange.parsed, exchange.written, exchange.materialized,
                          exchange.verified, exchange.workers, exchange.providers), (0,) * 7)
        self.assertEqual(exchange.handles, [])

    async def next_succeeds(self):
        self.assertEqual(self.admission._slots._value, 2)
        exchange = await Exchange().run(self.app)
        self.assertEqual(exchange.status, 200)
        self.assertTrue(exchange.handles and all(f.closed for f in exchange.handles))
        self.assertEqual(self.admission._slots._value, 2)

    async def test_full_admission_20_requests_zero_work_even_false_lengths(self):
        self.admission._slots.acquire()
        self.admission._slots.acquire()
        try:
            exchanges = [Exchange(data=b"x" * 1024, length=1 if i % 2 else None) for i in range(20)]
            await asyncio.gather(*(e.run(self.app) for e in exchanges))
            for e in exchanges:
                self.assertEqual((e.status, e.code), (503, "AUDIO_CAPACITY_EXCEEDED"))
                self.zero_work(e)
        finally:
            self.admission._slots.release()
            self.admission._slots.release()
        await self.next_succeeds()

    async def test_provider_wait_keeps_capacity_after_verifier_returns(self):
        self.stt.block = True
        holders = [Exchange() for _ in range(2)]
        tasks = [asyncio.create_task(e.run(self.app)) for e in holders]
        try:
            await until(lambda: self.stt.entered == 2)
            self.assertEqual(media._WORKER_SLOTS._value, 2)
            self.assertEqual(self.admission._slots._value, 0)
            extras = [Exchange() for _ in range(20)]
            await asyncio.gather(*(e.run(self.app) for e in extras))
            for e in extras:
                self.zero_work(e)
                self.assertEqual(e.code, "AUDIO_CAPACITY_EXCEEDED")
        finally:
            self.stt.block = False
            self.stt.release.set()
            await asyncio.gather(*tasks)
        self.assertTrue(all(e.status == 200 and all(f.closed for f in e.handles) for e in holders))
        await self.next_succeeds()

    async def test_verifier_wait_keeps_request_capacity(self):
        entered = 0
        release = asyncio.Event()
        original = media._wav
        async def blocked(audio):
            nonlocal entered
            if not media._WORKER_SLOTS.acquire(blocking=False):
                raise AssertionError("unexpected worker over-admission")
            try:
                entered += 1
                await release.wait()
                return original(audio.data)
            finally:
                media._WORKER_SLOTS.release()
        app = factory.create_app(settings=test_settings(), verifier=FakeVerifier(), limiter=AllowRate(),
            stt_provider=self.stt, llm_provider=self.llm, quota_service=self.quota,
            duration_verifier=blocked, audio_admission=self.admission)
        holders = [asyncio.create_task(Exchange().run(app)) for _ in range(2)]
        try:
            await until(lambda: entered == 2)
            extras = [Exchange() for _ in range(20)]
            await asyncio.gather(*(e.run(app) for e in extras))
            for e in extras:
                self.zero_work(e)
            self.assertEqual(media._WORKER_SLOTS._value, 0)
        finally:
            release.set()
            await asyncio.gather(*holders)
        await self.next_succeeds()

    async def test_independent_busy_worker_releases_request_capacity(self):
        media._WORKER_SLOTS.acquire()
        media._WORKER_SLOTS.acquire()
        try:
            result = await Exchange().run(self.app)
            self.assertEqual(result.code, "AUDIO_VERIFIER_BUSY")
            self.assertEqual(result.providers, 0)
            self.assertEqual(self.admission._slots._value, 2)
        finally:
            media._WORKER_SLOTS.release()
            media._WORKER_SLOTS.release()
        await self.next_succeeds()

    async def test_auth_off_rate_gates_do_not_acquire(self):
        class DenyRate:
            async def allow(self, *_):
                return False, 60
        for token, enabled, limiter, status in [(None, True, AllowRate(), 401),
                ("invalid-token", True, AllowRate(), 401), ("valid-token", False, AllowRate(), 503),
                ("valid-token", True, DenyRate(), 429)]:
            app = factory.create_app(settings=test_settings(ai_enabled=enabled), verifier=FakeVerifier(),
                stt_provider=self.stt, llm_provider=self.llm, limiter=limiter,
                quota_service=self.quota, audio_admission=self.admission)
            with patch.object(self.admission, "run", side_effect=AssertionError("must not acquire")):
                result = await Exchange(token=token).run(app)
            self.assertEqual(result.status, status)
            self.zero_work(result)

    async def test_invalid_too_long_malformed_and_disconnect_release(self):
        for exchange in [Exchange(data=b"invalid"), Exchange(data=wav(1920001)),
                         Exchange(interrupted=True), Exchange(mime="audio/mpeg")]:
            await exchange.run(self.app)
            self.assertIn(exchange.status, [413, 415, 422])
            self.assertEqual(exchange.providers, 0)
            self.assertTrue(all(f.closed for f in exchange.handles))
            await self.next_succeeds()

    async def test_quota_disabled_quota_exceeded_and_unexpected_failure_release(self):
        for error in [AppError("AI_DISABLED", 503, "safe"), AppError("QUOTA_EXCEEDED", 429, "safe"),
                      RuntimeError("PRIVATE_SYNTHETIC_DETAILS")]:
            with patch.object(self.quota, "begin_voice", side_effect=error):
                result = await Exchange().run(self.app)
            self.assertIn(result.status, [429, 500, 503])
            self.assertEqual(result.providers, 0)
            self.assertTrue(all(f.closed for f in result.handles))
            self.assertNotIn("PRIVATE", str(result.messages))
            await self.next_succeeds()

    async def test_provider_timeout_exception_and_parser_failure_release(self):
        for error in [TimeoutError, RuntimeError]:
            self.stt.error = error
            result = await Exchange().run(self.app)
            self.stt.error = None
            self.assertIn(result.status, [502, 504])
            self.assertTrue(all(f.closed for f in result.handles))
            await self.next_succeeds()
        with patch.object(self.llm, "complete_json", side_effect=RuntimeError("synthetic")):
            result = await Exchange().run(self.app)
        self.assertEqual(result.status, 502)
        await self.next_succeeds()

    async def test_accounting_wait_is_inside_admission(self):
        entered, release = asyncio.Event(), asyncio.Event()
        reconcile = self.quota.repository.reconcile
        async def blocked(*args):
            entered.set()
            await release.wait()
            return await reconcile(*args)
        with patch.object(self.quota.repository, "reconcile", blocked):
            task = asyncio.create_task(Exchange().run(self.app))
            try:
                await asyncio.wait_for(entered.wait(), 5)
                self.assertEqual(self.admission._slots._value, 1)
            finally:
                release.set()
                await task
        await self.next_succeeds()

    async def cancel_and_check(self, exchange, ready):
        task = asyncio.create_task(exchange.run(self.app))
        try:
            await asyncio.wait_for(ready.wait(), 10)
        finally:
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
        self.assertTrue(exchange.handles and all(f.closed for f in exchange.handles))
        self.assertEqual(self.admission._slots._value, 2)

    async def test_cancel_during_multipart(self):
        exchange = Exchange(stop_in_body=True)
        await self.cancel_and_check(exchange, exchange.body_wait)
        await self.next_succeeds()

    async def test_cancel_after_multipart_before_verifier(self):
        ready = asyncio.Event()
        original = factory.read_validated_audio
        async def blocked(*args):
            audio = await original(*args)
            ready.set()
            await asyncio.Event().wait()
            return audio
        with patch.object(factory, "read_validated_audio", blocked):
            await self.cancel_and_check(Exchange(), ready)
        await self.next_succeeds()

    async def test_cancel_before_quota(self):
        ready = asyncio.Event()
        async def blocked(*args):
            ready.set()
            await asyncio.Event().wait()
        with patch.object(self.quota, "begin_voice", blocked):
            await self.cancel_and_check(Exchange(), ready)
        await self.next_succeeds()

    async def test_cancel_during_provider(self):
        ready = asyncio.Event()
        async def blocked(request):
            ready.set()
            await asyncio.Event().wait()
        with patch.object(self.stt, "transcribe", blocked):
            await self.cancel_and_check(Exchange(), ready)
        await self.next_succeeds()

    async def test_cancel_real_worker_reaps_child_and_temp_before_release(self):
        with tempfile.TemporaryDirectory() as directory:
            data = compressed(directory)["valid"]
        ready, children, paths = asyncio.Event(), [], []
        original = asyncio.create_subprocess_exec
        async def spawn(*args, **kwargs):
            child = await original(sys.executable, "-I", media._WORKER, sys.executable,
                "-c", "import time; time.sleep(30)", **kwargs)
            children.append(child)
            paths.append(Path(args[args.index("-i") + 1]))
            ready.set()
            return child
        release = self.admission._slots.release
        def checked_release():
            self.assertTrue(all(c.returncode is not None for c in children))
            self.assertTrue(all(not p.parent.exists() for p in paths))
            release()
        with patch.object(media.asyncio, "create_subprocess_exec", spawn), \
             patch.object(self.admission._slots, "release", checked_release):
            await self.cancel_and_check(Exchange(data, mime="audio/m4a"), ready)
        self.assertEqual(media._WORKER_SLOTS._value, 2)
        await self.next_succeeds()

    async def test_canonical_refs_gone_before_release_success_and_error_no_gc(self):
        class TrackedAudio(ValidatedAudio):
            pass
        refs = []
        canonical = media._canonical
        def tracked(*args):
            result = canonical(*args)
            audio = TrackedAudio(result.audio.data, result.audio.content_type, result.audio.safe_filename)
            refs.append(weakref.ref(audio))
            return media.VerifiedMedia(audio, result.duration)
        release = self.admission._slots.release
        def checked_release():
            self.assertTrue(refs and all(r() is None for r in refs))
            release()
        was_enabled = gc.isenabled()
        gc.disable()
        try:
            with patch.object(media, "_canonical", tracked), \
                 patch.object(self.admission._slots, "release", checked_release):
                success = await Exchange().run(self.app)
                self.assertEqual(success.status, 200)
                self.stt.error = RuntimeError
                failed = await Exchange().run(self.app)
                self.assertEqual(failed.status, 502)
        finally:
            self.stt.error = None
            if was_enabled:
                gc.enable()

    async def test_large_audio_provider_wait_memory_probe(self):
        # Same 120s/48kHz/stereo/23,040,044-byte WAV as the independent review.
        # Assert ownership/zero consumption, NOT a platform-dependent RSS limit.
        class TrackedAudio(ValidatedAudio):
            pass
        data = wav(120 * 48000, 2, 48000)
        refs, maximum = [], 0
        canonical = media._canonical
        def tracked(*args):
            nonlocal maximum
            result = canonical(*args)
            audio = TrackedAudio(result.audio.data, result.audio.content_type, result.audio.safe_filename)
            refs.append(weakref.ref(audio))
            maximum = max(maximum, sum(r() is not None for r in refs))
            return media.VerifiedMedia(audio, result.duration)
        self.stt.block = True
        holders = [Exchange(data) for _ in range(2)]
        tracemalloc.start()
        baseline = tracemalloc.get_traced_memory()[0]
        started = time.monotonic()
        try:
            with patch.object(media, "_canonical", tracked):
                tasks = [asyncio.create_task(e.run(self.app)) for e in holders]
                try:
                    def ready():
                        if any(t.done() for t in tasks) and self.stt.entered < 2:
                            self.fail(f"request ended before provider wait: {[(e.status, e.code if e.status else None, e.consumed, e.materialized) for e in holders]}")
                        return self.stt.entered == 2
                    # tracemalloc + asyncio debug + amd64 emulation makes 704
                    # disk-backed upload writes slow; this is a test setup deadline,
                    # not any production provider/decoder timeout or acceptance gate.
                    await until(ready, timeout=45)
                    ready_seconds = time.monotonic() - started
                    current, peak = tracemalloc.get_traced_memory()
                    tracemalloc.reset_peak()
                    extras = [Exchange(data) for _ in range(20)]
                    await asyncio.gather(*(e.run(self.app) for e in extras))
                    _, denied_peak = tracemalloc.get_traced_memory()
                    for e in extras:
                        self.zero_work(e)
                        self.assertEqual(e.code, "AUDIO_CAPACITY_EXCEEDED")
                    self.assertEqual(maximum, 2)
                    print(json.dumps({"probe": "audio-request-admission", "input_bytes": len(data),
                        "admitted": 2, "denied": 20, "denied_body_bytes": sum(e.consumed for e in extras),
                        "denied_materialized_bytes": sum(e.materialized for e in extras),
                        "max_live_canonical_objects": maximum,
                        "provider_ready_seconds": round(ready_seconds, 2),
                        "provider_wait_heap_mib": round((current - baseline) / 1048576, 2),
                        "admission_peak_heap_mib": round((peak - baseline) / 1048576, 2),
                        "denied_incremental_peak_mib": round((denied_peak - current) / 1048576, 2),
                        "actual_provider_calls": 0}), flush=True)
                finally:
                    self.stt.block = False
                    self.stt.release.set()
                    await asyncio.gather(*tasks)
            self.assertEqual(maximum, 2)
            self.assertTrue(all(r() is None for r in refs))
            self.assertTrue(all(e.status == 200 and all(f.closed for f in e.handles) for e in holders))
        finally:
            tracemalloc.stop()
        await self.next_succeeds()


if __name__ == "__main__":
    unittest.main()
