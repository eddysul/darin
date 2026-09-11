from __future__ import annotations

import asyncio
import hashlib
import io
import json
import logging
import os
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import AsyncMock, patch
import wave

from fastapi.testclient import TestClient

from server.ai.app import audio_duration as media
from server.ai.app.audio import ValidatedAudio
from server.ai.app.errors import AppError
from server.ai.app.factory import create_app
from server.ai.app.privacy_log import PrivacyLogger
from server.ai.app.quota.pricing import make_stage
from server.ai.tests.audio_fixtures import compressed, wav
from server.ai.tests.quota_fake import SharedState, service
from server.ai.tests.support import FakeVerifier, FakeLlmProvider, FakeSttProvider, auth_headers, test_settings


def audio(data, mime="audio/wav"):
    return ValidatedAudio(data, mime, "UNTRUSTED -i https://invalid.example/secret")


class AudioDurationTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture_dir = tempfile.TemporaryDirectory(prefix="synthetic-audio-")
        try:
            cls.fixtures = compressed(cls.fixture_dir.name)
        except BaseException:
            cls.fixture_dir.cleanup()
            raise

    @classmethod
    def tearDownClass(cls):
        cls.fixture_dir.cleanup()

    async def verify(self, data, mime="audio/wav"):
        return await media.AudioDurationVerifier()(audio(data, mime))

    async def rejects(self, data, code=None, mime="audio/wav"):
        with self.assertRaises(AppError) as raised:
            await self.verify(data, mime)
        if code:
            self.assertEqual(raised.exception.code, code)

    async def test_wav_4095_exact_samples_and_wire_hash(self):
        result = await self.verify(wav())
        self.assertEqual(result.duration.milliseconds, 4095)
        self.assertEqual(result.duration.sample_count, 65520)
        self.assertEqual(result.duration.sample_rate, 16000)
        self.assertEqual(result.duration.extraction_method, "pcm-frames.v1")
        self.assertEqual(result.duration.audio_digest, hashlib.sha256(result.audio.data).hexdigest())
        self.assertEqual(result.audio.safe_filename, "recording.wav")

    async def test_wav_mono_stereo_short_and_one_second(self):
        for channels in [1, 2]:
            for rate in sorted(media.SAMPLE_RATES):
                for frames in [1, rate]:
                    result = await self.verify(wav(frames, channels, rate))
                    self.assertEqual(result.duration.milliseconds, (frames * 1000 + rate - 1) // rate)
                    with wave.open(io.BytesIO(result.audio.data)) as reader:
                        self.assertEqual((reader.getnchannels(), reader.getnframes()), (channels, frames))

    async def test_wav_exact_boundary_and_one_sample_each_side(self):
        maximum = media.MAX_AUDIO_SECONDS * 16000
        for frames in [maximum - 1, maximum]:
            result = await self.verify(wav(frames))
            self.assertEqual(result.duration.sample_count, frames)
        await self.rejects(wav(maximum + 1), "AUDIO_TOO_LONG")

    async def test_wav_zero_frames_reject(self):
        await self.rejects(wav(0), "AUDIO_DURATION_UNVERIFIED")

    async def test_wav_truncation_and_appended_data_reject(self):
        for data in [wav()[:-1], wav()[:40], wav() + b"junk"]:
            await self.rejects(data, "AUDIO_METADATA_INVALID")

    async def test_wav_forged_riff_data_sizes_and_rate_reject(self):
        for offset, value in [(4, 0xffffffff), (40, 0xffffffff), (40, 2), (28, 1), (24, 0)]:
            data = bytearray(wav())
            struct.pack_into("<I", data, offset, value)
            await self.rejects(bytes(data))

    async def test_wav_unknown_encoding_and_partial_sample_reject(self):
        data = bytearray(wav())
        struct.pack_into("<H", data, 20, 3)
        await self.rejects(bytes(data), "AUDIO_FORMAT_UNSUPPORTED")
        data = bytearray(wav())
        struct.pack_into("<I", data, 40, len(data) - 45)
        await self.rejects(bytes(data), "AUDIO_METADATA_INVALID")

    async def test_wav_benign_extra_chunk_removed_from_wire(self):
        data = bytearray(wav())
        extra = b"JUNK" + struct.pack("<I", 7) + b"PRIVATE" + b"\0"
        data[12:12] = extra
        struct.pack_into("<I", data, 4, len(data) - 8)
        result = await self.verify(bytes(data))
        self.assertEqual(result.audio.data, wav())
        self.assertNotIn(b"PRIVATE", result.audio.data)

    async def test_wav_duplicate_and_excessive_chunks_reject(self):
        for chunk in [wav()[12:36], b"JUNK\0\0\0\0" * 130]:
            data = bytearray(wav() + chunk)
            struct.pack_into("<I", data, 4, len(data) - 8)
            await self.rejects(bytes(data), "AUDIO_METADATA_INVALID")

    async def test_aac_valid_and_vbr_fully_decoded_to_wav(self):
        for name in ["valid", "vbr"]:
            result = await self.verify(self.fixtures[name], "audio/m4a")
            self.assertEqual(result.audio.content_type, "audio/wav")
            self.assertEqual(result.duration.extraction_method, "aac-full-decode-pcm.v1")
            self.assertGreater(result.duration.sample_count, 0)
            self.assertLess(result.duration.milliseconds, 4300)
            with wave.open(io.BytesIO(result.audio.data)) as reader:
                self.assertEqual(reader.getnframes(), result.duration.sample_count)

    async def test_aac_real_verifier_route_to_fake_providers(self):
        state = SharedState()
        llm = FakeLlmProvider({"events": [{"category": "식사", "time": "15:00", "type": "분유", "amount": 120, "note": None}]})
        stt = FakeSttProvider()
        with TestClient(create_app(settings=test_settings(), verifier=FakeVerifier(),
            llm_provider=llm, stt_provider=stt, quota_service=service(state))) as client:
            response = client.post("/v1/transcribe", headers=auth_headers(),
                files={"file": ("synthetic.m4a", self.fixtures["valid"], "audio/m4a")})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(llm.requests), 1)
        self.assertEqual(len(stt.requests), 1)
        self.assertEqual(stt.requests[0].content_type, "audio/wav")
        expected = await self.verify(self.fixtures["valid"], "audio/m4a")
        self.assertEqual(stt.requests[0].data, expected.audio.data)

    async def test_remote_dref_http_file_and_protocol_rejected_before_probe(self):
        for reference in [b"https://invalid.example/private", b"file:///etc/passwd", b"concat:a|b"]:
            original = self.fixtures["valid"]
            at = original.index(b"url ") - 4
            self.assertEqual(struct.unpack_from(">I", original, at)[0], 12)
            entry = struct.pack(">I4sI", 13 + len(reference), b"url ", 0) + reference + b"\0"
            data = bytearray(original[:at] + entry + original[at + 12:])
            delta = len(entry) - 12
            for kind in [b"moov", b"trak", b"mdia", b"minf", b"dinf", b"dref"]:
                pos = data.index(kind) - 4
                struct.pack_into(">I", data, pos, struct.unpack_from(">I", data, pos)[0] + delta)
            runner = AsyncMock(side_effect=AssertionError("remote reference must not reach media tools"))
            with patch.object(media, "_run", runner):
                await self.rejects(bytes(data), "AUDIO_FORMAT_UNSUPPORTED", "audio/m4a")
            runner.assert_not_called()

    async def test_bmff_overflow_malformed_extra_stream_and_missing_reference(self):
        original = self.fixtures["valid"]
        extra = bytearray(original)
        pos = extra.index(b"moov") - 4
        length = struct.unpack_from(">I", extra, pos)[0]
        extra[pos + length:pos + length] = b"\0\0\0\x08trak"
        struct.pack_into(">I", extra, pos, length + 8)
        for data in [b"\0\0\0\1ftyp" + b"\xff" * 8, original + b"\0\0\0\x08moof",
                     original.replace(b"dref", b"xxxx", 1), original[:-1], bytes(extra)]:
            await self.rejects(data, mime="audio/mp4")

    async def test_small_but_1800_second_compressed_file_reject(self):
        self.assertLess(len(self.fixtures["long"]), media.MAX_INPUT_BYTES)
        await self.rejects(self.fixtures["long"], "AUDIO_TOO_LONG", "audio/mp4")

    async def test_aac_truncated_and_corrupted_samples_reject(self):
        data = self.fixtures["valid"]
        await self.rejects(data[:-100], mime="audio/m4a")
        corrupt = bytearray(data)
        start = corrupt.index(b"mdat") + 4
        corrupt[start:] = b"\xff" * (len(corrupt) - start)
        await self.rejects(bytes(corrupt), mime="audio/m4a")

    async def test_aac_two_audio_video_and_cover_art_reject(self):
        for name in ["two_audio", "video", "cover"]:
            with self.subTest(name=name):
                await self.rejects(self.fixtures[name], mime="audio/m4a")

    async def test_duration_spoof_does_not_shrink_sample_based_bound(self):
        # Forge mdhd's declared track duration to 1 tick, without changing samples.
        data = bytearray(self.fixtures["valid"])
        at = data.index(b"mdhd")
        self.assertEqual(data[at + 4], 0)
        struct.pack_into(">I", data, at + 20, 1)
        try:
            result = await self.verify(bytes(data), "audio/m4a")
        except AppError:
            return  # Strict rejection is also safe.
        self.assertGreaterEqual(result.duration.milliseconds, 4095)

    async def test_nonfinite_missing_zero_negative_metadata_reject(self):
        base = {"codec_type": "audio", "codec_name": "aac", "profile": "LC", "channels": 1,
                "sample_rate": "16000", "duration": "4.095"}
        for value in [None, "NaN", "Infinity", "-Infinity", "0", "-1", "1e999999", "oops"]:
            with self.subTest(value=value), self.assertRaises(AppError):
                media._stream_info(json.dumps({"streams": [{**base, "duration": value}]}).encode())
        del base["duration"]
        with self.assertRaises(AppError):
            media._stream_info(json.dumps({"streams": [base]}).encode())

    async def test_unsupported_codec_and_formats_reject(self):
        for mime, data in [("audio/mpeg", b"ID3"), ("audio/webm", b"\x1aE\xdf\xa3"),
                           ("application/octet-stream", wav())]:
            await self.rejects(data, "AUDIO_FORMAT_UNSUPPORTED", mime)
        with self.assertRaises(AppError):
            media._stream_info(b'{"streams":[{"codec_name":"alac"}]}')

    async def test_malformed_fuzz_is_bounded_and_closed(self):
        for data in [b"", b"RIFF", b"\0" * 300, b"RIFF\xff\xff\xff\xffWAVE", b"WAVE" * 1000]:
            await self.rejects(data)
        for data in [b"\0\0\0\x18ftyp" + b"\xff" * 500, b"https://invalid.example/audio"]:
            await self.rejects(data, mime="audio/m4a")

    async def test_pricing_rounds_samples_then_full_minutes(self):
        for frames, minutes in [(1, 1), (65520, 1), (960000, 1), (960001, 2), (1920000, 2)]:
            proof = (await self.verify(wav(frames))).duration
            stage = make_stage("stt", "whisper-1", 0, "a" * 64, proof)
            self.assertEqual(stage.reserved, minutes * 6000)
            self.assertEqual(stage.duration_ms, minutes * 60000)

    async def test_missing_tool_fails_closed(self):
        with patch.object(media.shutil, "which", return_value=None):
            await self.rejects(self.fixtures["valid"], "COST_BOUND_UNAVAILABLE", "audio/m4a")

    async def test_fixed_arguments_disable_external_references_and_injection(self):
        original = media._run
        calls = []
        async def capture(tool, args, *rest):
            calls.append((tool, args))
            return await original(tool, args, *rest)
        with patch.object(media, "_run", capture):
            await self.verify(self.fixtures["valid"], "audio/m4a")
        for _, args in calls:
            self.assertEqual(args[args.index("-protocol_whitelist") + 1], "file")
            self.assertEqual(args[args.index("-enable_drefs") + 1], "0")
            self.assertEqual(args[args.index("-use_absolute_path") + 1], "0")
            self.assertNotIn("UNTRUSTED", " ".join(args))
            self.assertFalse(Path(args[args.index("-i") + 1]).exists())

    async def test_temp_cleanup_on_probe_failure(self):
        paths = []
        async def failure(_, args, *rest):
            paths.append(Path(args[args.index("-i") + 1]))
            raise AppError("AUDIO_DURATION_UNVERIFIED", 422, "safe")
        with patch.object(media, "_run", failure):
            await self.rejects(self.fixtures["valid"], mime="audio/m4a")
        self.assertTrue(paths)
        self.assertTrue(all(not p.parent.exists() for p in paths))

    async def test_global_worker_slots_bounded_and_released(self):
        gate = asyncio.Event()
        entered = []
        async def waiting(*args):
            entered.append(True)
            await gate.wait()
        with patch.object(media, "_run", waiting):
            tasks = [asyncio.create_task(self.verify(self.fixtures["valid"], "audio/m4a")) for _ in range(2)]
            while len(entered) < 2:
                await asyncio.sleep(0)
            await self.rejects(self.fixtures["valid"], "AUDIO_VERIFIER_BUSY", "audio/m4a")
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
        self.assertEqual((await self.verify(wav())).duration.milliseconds, 4095)

    async def test_process_timeout_and_cancel_reap_child(self):
        original = asyncio.create_subprocess_exec
        children = []
        input_paths = []
        async def spawn(*args, **kwargs):
            # Synthetic stuck process runs under the SAME resource-limit helper.
            child = await original(sys.executable, "-I", media._WORKER, sys.executable,
                "-c", "import time; time.sleep(30)", **kwargs)
            children.append(child)
            input_paths.append(Path(args[args.index("-i") + 1]))
            return child
        with patch.object(media.asyncio, "create_subprocess_exec", spawn):
            with patch.object(media, "WORKER_TIMEOUT_SECONDS", .1):
                await self.rejects(self.fixtures["valid"], mime="audio/m4a")
            task = asyncio.create_task(self.verify(self.fixtures["valid"], "audio/m4a"))
            while len(children) < 2:
                await asyncio.sleep(.01)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
        self.assertTrue(all(child.returncode is not None for child in children))
        self.assertTrue(all(not p.parent.exists() for p in input_paths))

    async def test_process_crash_stdout_stderr_limits_and_safe_errors(self):
        original = asyncio.create_subprocess_exec
        for program in ["raise SystemExit(9)", "print('x'*1000000)",
                        "import sys; sys.stderr.write('PRIVATE_AUDIO'*100000)"]:
            children = []
            async def spawn(*args, **kwargs):
                child = await original(sys.executable, "-I", media._WORKER, sys.executable,
                    "-c", program, **kwargs)
                children.append(child)
                return child
            with patch.object(media.asyncio, "create_subprocess_exec", spawn):
                with self.assertRaises(AppError) as raised:
                    await media._run("ffprobe", [], 1024)
                self.assertNotIn("PRIVATE", raised.exception.message)
            self.assertTrue(all(child.returncode is not None for child in children))

    async def test_repeated_cancel_cannot_abandon_cleanup(self):
        original = asyncio.create_subprocess_exec
        spawned, reaping, release = asyncio.Event(), asyncio.Event(), asyncio.Event()
        children, paths = [], []
        async def spawn(*args, **kwargs):
            child = await original(sys.executable, "-I", media._WORKER, sys.executable,
                "-c", "import time; time.sleep(30)", **kwargs)
            wait = child.wait
            async def delayed_reap():
                result = await wait()
                reaping.set()
                await release.wait()
                return result
            child.wait = delayed_reap
            children.append(child)
            paths.append(Path(args[args.index("-i") + 1]))
            spawned.set()
            return child
        with patch.object(media.asyncio, "create_subprocess_exec", spawn):
            task = asyncio.create_task(self.verify(self.fixtures["valid"], "audio/m4a"))
            await asyncio.wait_for(spawned.wait(), 3)
            task.cancel()
            await asyncio.wait_for(reaping.wait(), 3)
            task.cancel()
            await asyncio.sleep(0)
            self.assertFalse(task.done())
            release.set()
            with self.assertRaises(asyncio.CancelledError):
                await asyncio.wait_for(task, 3)
        self.assertTrue(all(p.returncode is not None for p in children))
        self.assertTrue(all(not p.parent.exists() for p in paths))

    async def test_worker_os_limits_and_no_inherited_credentials(self):
        original = asyncio.create_subprocess_exec
        async def spawn(*args, **kwargs):
            code = ("import resource,json,os;print(json.dumps({'cpu':resource.getrlimit(resource.RLIMIT_CPU),"
                    "'fd':resource.getrlimit(resource.RLIMIT_NOFILE),'fs':resource.getrlimit(resource.RLIMIT_FSIZE),"
                    "'as':resource.getrlimit(resource.RLIMIT_AS),'proc':resource.getrlimit(resource.RLIMIT_NPROC),"
                    "'env':sorted(os.environ)}))")
            return await original(sys.executable, "-I", media._WORKER, sys.executable, "-c", code, **kwargs)
        with patch.dict(os.environ, {"PRIVATE_PROVIDER_KEY": "synthetic"}), \
             patch.object(media.asyncio, "create_subprocess_exec", spawn):
            result = json.loads(await media._run("ffprobe", [], 4096))
        self.assertEqual(result["cpu"], [6, 7])
        self.assertEqual(result["fd"], [64, 64])
        self.assertEqual(result["fs"], [0, 0])
        self.assertNotIn("PRIVATE_PROVIDER_KEY", result["env"])
        if sys.platform == "linux":
            self.assertEqual(result["as"], [768 * 1024 * 1024] * 2)
            self.assertEqual(result["proc"], [64, 64])


class AudioDurationRouteTests(unittest.TestCase):
    def setUp(self):
        self.state = SharedState()
        self.llm = FakeLlmProvider({"events": [{"category": "식사", "time": "15:00", "type": "분유", "amount": 120, "note": None}]})
        self.stt = FakeSttProvider()
        self.output = io.StringIO()
        logger = logging.Logger("synthetic-audio-test", logging.INFO)
        logger.addHandler(logging.StreamHandler(self.output))
        # No duration DI: real production verifier, only auth/store/providers faked.
        self.client = TestClient(create_app(settings=test_settings(), verifier=FakeVerifier(),
            llm_provider=self.llm, stt_provider=self.stt, quota_service=service(self.state),
            privacy_logger=PrivacyLogger(logger)), raise_server_exceptions=False)
        self.addCleanup(self.client.close)

    def post(self, data=None, mime="audio/wav", fields=None):
        return self.client.post("/v1/transcribe", headers=auth_headers(),
            files={"file": ("PRIVATE_FILE ; $(echo private).wav", wav() if data is None else data, mime)},
            data=fields or {})

    def test_real_verifier_fake_stt_parser_and_reservation_success(self):
        response = self.post()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["events"][0]["amount"], 120)
        self.assertEqual(len(self.stt.requests), 1)
        self.assertEqual(len(self.llm.requests), 1)
        request = self.stt.requests[0]
        self.assertEqual((request.filename, request.content_type), ("recording.wav", "audio/wav"))
        self.assertEqual(request.data, wav())
        record = next(v for k, v in self.state.data.items() if k.startswith("reservations/"))
        self.assertEqual([s["state"] for s in record["stages"]], ["SETTLED", "SETTLED"])
        self.assertEqual(record["stages"][0]["duration_ms"], 60000)

    def test_invalid_duration_never_reserves_or_calls_provider(self):
        for data in [wav(0), wav()[:-1], wav(1920001)]:
            self.assertIn(self.post(data).status_code, [413, 422])
        self.assertEqual(self.stt.requests, [])
        self.assertEqual(self.llm.requests, [])
        self.assertFalse(any(k.startswith("reservations/") for k in self.state.data))

    def test_client_duration_is_not_accepted(self):
        self.assertEqual(self.post(fields={"duration": "0.001"}).status_code, 422)
        self.assertEqual(self.stt.requests, [])

    def test_spoofed_mime_and_remote_reference_fail_before_provider(self):
        for data, mime in [(wav(), "audio/m4a"), (b"https://invalid.example/private", "audio/wav"),
                           (b"ID3" + b"private", "audio/mpeg")]:
            self.assertIn(self.post(data, mime).status_code, [415, 422])
        self.assertEqual(self.stt.requests, [])

    def test_logs_and_errors_contain_no_media_or_filename(self):
        self.post()
        self.post(wav()[:-1])
        logs = self.output.getvalue()
        for forbidden in ["PRIVATE_FILE", "valid-token", "Authorization", "분유", "RIFF", "ffprobe", "stderr"]:
            self.assertNotIn(forbidden, logs)


class AudioDurationAuthBoundaryTests(unittest.IsolatedAsyncioTestCase):
    async def test_no_auth_and_invalid_auth_oversized_body_never_reaches_verifier(self):
        # Reuse the measured ASGI boundary harness, replacing its factory with the
        # real default verifier; zero-byte assertions also prove no decode/spool.
        from server.ai.tests.test_p0_upload_boundary import UploadBoundaryTests, part
        import server.ai.tests.test_p0_upload_boundary as harness
        check = UploadBoundaryTests()
        verifier = AsyncMock(side_effect=AssertionError("must not verify"))
        def real_factory(**kwargs):
            return create_app(**kwargs, duration_verifier=verifier, quota_service=service())
        with patch.object(harness, "create_app", real_factory):
            for token in [None, "invalid-token"]:
                result = await check.request([part(b"x" * (2 * 1024 * 1024))], token=token)
                self.assertEqual(result[:5], (401, 0, 0, 0, 0))
                self.assertEqual(result[5], [])
                self.assertEqual(result[6].requests, [])
                self.assertEqual(result[7].requests, [])
            result = await check.request([part(b"x" * (2 * 1024 * 1024))], length=2 * 1024 * 1024)
            self.assertEqual(result[:5], (413, 0, 0, 0, 0))
        verifier.assert_not_called()
