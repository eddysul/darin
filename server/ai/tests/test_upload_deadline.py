"""Real route/receive/parser tests, synthetic audio and fake providers only."""
from __future__ import annotations

import asyncio
import copy
from contextlib import ExitStack
import gc
import json
import logging
import os
import socket
import unittest
from unittest.mock import patch
import weakref

from anyio import CancelScope, current_time
import httpx
import uvicorn

from server.ai.app import factory, upload
from server.ai.app.audio_admission import AudioRequestAdmission
from server.ai.app.auth import AuthContext
from server.ai.app.privacy_log import PrivacyLogger
from server.ai.tests.audio_fixtures import wav
from server.ai.tests.quota_fake import service
from server.ai.tests.support import FakeLlmProvider, FakeVerifier, auth_headers, test_settings
from server.ai.tests.test_audio_admission import (
    AllowRate, Exchange, NonRetainingStt, Observe, _EXCHANGE, until,
)


HEADER = (b'--audio\r\nContent-Disposition: form-data; name="file"; filename="x"\r\n'
          b'Content-Type: audio/wav\r\n\r\n')
PREFIX_107 = HEADER + b'x' * (107 - len(HEADER))
END = b'\r\n--audio--\r\n'


class ScriptedUpload(Exchange):
    """Drive a real ASGI body without synthesizing progress after the script ends."""
    def __init__(self, **kwargs):
        super().__init__(data=b'', **kwargs)
        self.queue = asyncio.Queue()
        self.active_reads = self.active_parsers = self.read_calls = 0
        self.close_calls = 0
        self.cleanup_hook = None
        self.waiting = asyncio.Event()

    def feed(self, body=b'', *, more=True):
        self.queue.put_nowait({'type': 'http.request', 'body': body, 'more_body': more})

    def disconnect(self):
        self.queue.put_nowait({'type': 'http.disconnect'})

    async def run(self, app):
        async def scripted_app(scope, _receive, send):
            async def receive():
                self.read_calls += 1
                self.active_reads += 1
                self.waiting.set()
                try:
                    message = await self.queue.get()
                    self.consumed += len(message.get('body', b''))
                    return message
                finally:
                    self.active_reads -= 1
            await app(scope, receive, send)
        return await super().run(scripted_app)


class Users(FakeVerifier):
    async def verify(self, token):
        if token in ('attacker', 'third-user'):
            return AuthContext(token)
        return await super().verify(token)


class UploadDeadlineTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.admission = AudioRequestAdmission()
        self.stt = NonRetainingStt()
        self.llm = FakeLlmProvider(*[{'events': []} for _ in range(50)])
        self.quota = service()
        self.scopes = []
        self.exchanges = []
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(Observe())
        original_parse = upload.BoundedMultipartParser.parse
        original_headers = upload.BoundedMultipartParser.on_headers_finished
        original_release = self.admission._slots.release

        def scope(**kwargs):
            result = CancelScope(**kwargs)
            self.scopes.append(result)
            return result

        async def parse(parser):
            exchange = _EXCHANGE.get()
            if not isinstance(exchange, ScriptedUpload):
                return await original_parse(parser)
            exchange.active_parsers += 1
            try:
                return await original_parse(parser)
            finally:
                exchange.active_parsers -= 1

        def headers(parser):
            original_headers(parser)
            exchange = _EXCHANGE.get()
            if not isinstance(exchange, ScriptedUpload):
                return
            for handle in parser.owned_files:
                if getattr(handle, '_deadline_test_tracked', False):
                    continue
                handle._deadline_test_tracked = True
                close = handle.close
                # Avoid retaining exchange/audio through the file's test hook.
                exchange_ref = weakref.ref(exchange)
                def checked_close(close=close, ref=exchange_ref):
                    owner = ref()
                    if owner:
                        owner.close_calls += 1
                        self.assertLess(self.admission._slots._value, 2)
                        if owner.cleanup_hook:
                            owner.cleanup_hook()
                    return close()
                handle.close = checked_close

        def checked_release():
            exchange = _EXCHANGE.get()
            if isinstance(exchange, ScriptedUpload):
                self.assertEqual((exchange.active_reads, exchange.active_parsers), (0, 0))
                self.assertTrue(all(f.closed for f in exchange.handles))
            original_release()
        for target, name, value in [(upload, 'CancelScope', scope),
                (upload.BoundedMultipartParser, 'parse', parse),
                (upload.BoundedMultipartParser, 'on_headers_finished', headers),
                (self.admission._slots, 'release', checked_release)]:
            self.stack.enter_context(patch.object(target, name, value))
        self.app = self.make_app()

    def make_app(self, timeout=1.0, **kwargs):
        return factory.create_app(settings=kwargs.pop('settings', test_settings()), verifier=Users(),
            stt_provider=self.stt, llm_provider=self.llm, quota_service=self.quota,
            audio_admission=self.admission, limiter=kwargs.pop('limiter', AllowRate()),
            upload_timeout_seconds=timeout, **kwargs)

    async def start(self, exchange, app=None):
        self.exchanges.append(exchange)
        task = asyncio.create_task(exchange.run(app or self.app))
        self.addAsyncCleanup(self.stop_task, task)
        await asyncio.wait_for(exchange.waiting.wait(), 5)
        return task

    async def stop_task(self, task):
        if not task.done():
            task.cancel()
        await asyncio.gather(task, return_exceptions=True)

    async def finish(self, task):
        return await asyncio.wait_for(task, 5)

    def assert_timeout(self, exchange):
        self.assertEqual((exchange.status, exchange.code), (408, 'AUDIO_UPLOAD_TIMEOUT'))
        self.assertEqual((exchange.materialized, exchange.verified, exchange.workers, exchange.providers), (0,) * 4)
        self.assertEqual((exchange.active_reads, exchange.active_parsers), (0, 0))
        self.assertTrue(all(f.closed for f in exchange.handles))
        self.assertEqual(exchange.close_calls, len(exchange.handles))

    async def recovered(self):
        self.assertEqual(self.admission._slots._value, 2)
        normal = await Exchange(token='third-user').run(self.app)
        self.assertEqual(normal.status, 200)
        self.assertEqual(self.admission._slots._value, 2)

    def test_startup_config_fails_closed_and_no_http_override(self):
        for timeout in (0, -1, float('nan'), float('inf'), -float('inf'),
                        180.001, 10**500, '120', None, True):
            with self.subTest(timeout=str(timeout)[:40]), self.assertRaises(ValueError):
                self.make_app(timeout)
        for valid in (.001, 120, 180):
            self.make_app(valid)
        operation = self.app.openapi()['paths']['/v1/transcribe']['post']
        self.assertNotIn('timeout', json.dumps(operation).lower())

    async def test_two_107_byte_stalls_deadline_then_third_user_recovers(self):
        baseline = asyncio.all_tasks()
        quota_before = copy.deepcopy(self.quota.repository.store.state.data)
        app = self.make_app(.4)
        holders = [ScriptedUpload(token='attacker', length=1048576) for _ in range(2)]
        with patch.object(upload.BoundedMultipartParser, 'spool_max_size', 1):
            tasks = []
            for exchange in holders:
                exchange.feed(PREFIX_107)
                tasks.append(await self.start(exchange, app))
            await until(lambda: all(e.consumed == 107 and e.active_reads for e in holders))
            self.assertEqual(self.admission._slots._value, 0)
            denied = [Exchange(data=wav(120 * 48000, 2, 48000), token='third-user')]
            denied.extend(Exchange(token='third-user') for _ in range(19))
            await asyncio.gather(*(e.run(app) for e in denied))
            for e in denied:
                self.assertEqual(e.code, 'AUDIO_CAPACITY_EXCEEDED')
                self.assertEqual((e.consumed, e.parsed, e.written, e.materialized, e.verified, e.providers), (0,) * 6)
            await asyncio.gather(*(self.finish(t) for t in tasks))
            for e in holders:
                self.assert_timeout(e)
                self.assertEqual(e.consumed, 107)
                self.assertTrue(e.handles[0]._rolled)
                # A response must leave no reader to consume subsequently sent data.
                calls = e.read_calls
                e.feed(b'synthetic-late-data')
                await asyncio.sleep(0)
                self.assertEqual(e.read_calls, calls)
        self.assertEqual(self.stt.entered, 0)
        self.assertEqual(self.quota.repository.store.state.data, quota_before)
        self.assertFalse(asyncio.all_tasks() - baseline)
        await self.recovered()

    async def test_continuous_slow_drip_does_not_extend_absolute_deadline(self):
        app = self.make_app(.15)
        holders, tasks = [], []
        for _ in range(2):
            e = ScriptedUpload(token='attacker')
            e.feed(PREFIX_107)
            holders.append(e)
            tasks.append(await self.start(e, app))
        deadlines = [s.deadline for s in self.scopes]
        async def drip(e, task):
            while not task.done():
                e.feed(b'x')
                await asyncio.sleep(.005)
        await asyncio.gather(*(drip(e, t) for e, t in zip(holders, tasks)),
                             *(self.finish(t) for t in tasks))
        for e in holders:
            self.assertGreater(e.consumed, 109)
            self.assert_timeout(e)
        self.assertEqual([s.deadline for s in self.scopes], deadlines)
        self.assertEqual(self.stt.entered, 0)
        await self.recovered()

    async def test_final_multipart_boundary_without_body_eof_still_times_out(self):
        e = ScriptedUpload()
        e.feed(HEADER + wav() + END)  # Complete multipart, but no final ASGI body.
        task = await self.start(e, self.make_app(.05))
        await self.finish(task)
        self.assert_timeout(e)

    async def test_no_first_byte_is_bounded(self):
        e = ScriptedUpload()
        await self.finish(await self.start(e, self.make_app(.03)))
        self.assert_timeout(e)
        self.assertEqual(e.consumed, 0)
        self.assertEqual(e.handles, [])

    async def test_valid_upload_just_before_deadline_deterministic_clock(self):
        # Advance only this helper's monotonic reads, not the event-loop clock.
        # Exercises deadline - epsilon without relying on a millisecond sleep.
        start = current_time()
        now = [start]
        e = ScriptedUpload()
        e.feed(HEADER + wav() + END, more=False)
        original_parse = upload.BoundedMultipartParser.parse
        async def near_deadline(parser):
            now[0] = start + 120 - .000001
            return await original_parse(parser)
        with patch.object(upload, 'current_time', lambda: now[0]), \
             patch.object(upload.BoundedMultipartParser, 'parse', near_deadline):
            await self.finish(await self.start(e, self.make_app(120)))
        self.assertEqual(e.status, 200)
        self.assertEqual((e.verified, e.providers), (1, 1))
        self.assertEqual(len(self.llm.requests), 1)
        self.assertEqual(self.admission._slots._value, 2)

    async def test_exact_deadline_buffered_body_rejected_without_provider(self):
        start = current_time()
        now = [start]
        e = ScriptedUpload()
        e.feed(HEADER + wav() + END, more=False)
        original_parse = upload.BoundedMultipartParser.parse
        async def at_deadline(parser):
            now[0] = start + 120
            return await original_parse(parser)
        with patch.object(upload, 'current_time', lambda: now[0]), \
             patch.object(upload.BoundedMultipartParser, 'parse', at_deadline):
            await self.finish(await self.start(e, self.make_app(120)))
        self.assert_timeout(e)

    async def test_timer_gone_before_provider_wait_admission_still_held(self):
        self.stt.block = True
        task = asyncio.create_task(Exchange().run(self.make_app(.1)))
        self.addAsyncCleanup(self.stop_task, task)
        await until(lambda: self.stt.entered == 1)
        await asyncio.sleep(.15)
        self.assertFalse(task.done())
        self.assertFalse(self.scopes[0].cancel_called)
        self.assertEqual(self.admission._slots._value, 1)
        self.stt.release.set()
        result = await self.finish(task)
        self.assertEqual(result.status, 200)
        self.assertEqual(self.admission._slots._value, 2)

    async def test_disconnect_prompt_and_timeout_disconnect_race(self):
        for simultaneous in (False, True):
            e = ScriptedUpload()
            e.feed(PREFIX_107)
            task = await self.start(e)
            await until(lambda: e.consumed == 107 and e.active_reads)
            if simultaneous:
                self.scopes[-1].deadline = current_time()
            e.disconnect()
            await self.finish(task)
            self.assertIn(e.status, (408, 422))
            self.assertEqual(e.close_calls, 1)
            self.assertTrue(e.handles[0].closed)
            self.assertEqual(self.admission._slots._value, 2)
            self.assertEqual(e.providers, 0)

    async def test_cancel_before_first_chunk_between_chunks_and_near_deadline(self):
        for mode in ('before', 'between', 'near'):
            e = ScriptedUpload()
            if mode != 'before':
                e.feed(PREFIX_107)
            task = await self.start(e)
            if mode != 'before':
                await until(lambda: e.consumed == 107 and e.active_reads)
            if mode == 'near':
                self.scopes[-1].deadline = current_time()
            task.cancel()
            result = (await asyncio.gather(task, return_exceptions=True))[0]
            self.assertIsInstance(result, asyncio.CancelledError)
            self.assertEqual((e.active_reads, e.active_parsers, e.providers), (0, 0, 0))
            self.assertTrue(all(f.closed for f in e.handles))
            self.assertEqual(e.close_calls, len(e.handles))
            self.assertEqual(self.admission._slots._value, 2)

    async def test_cancellation_in_timeout_cleanup_and_just_after_timeout(self):
        for mode in ('cleanup', 'after'):
            e = ScriptedUpload()
            e.feed(PREFIX_107)
            task = await self.start(e)
            await until(lambda: e.consumed == 107 and e.active_reads)
            if mode == 'cleanup':
                # Synchronous close is deliberately non-awaiting; inject cancel
                # at its entry to prove it cannot release before closing files.
                e.cleanup_hook = lambda: task.cancel()
            self.scopes[-1].deadline = current_time()
            result = (await asyncio.gather(task, return_exceptions=True))[0]
            if mode == 'cleanup':
                self.assertIsInstance(result, asyncio.CancelledError)
            else:
                self.assert_timeout(e)
                self.assertFalse(task.cancel())
            self.assertEqual(e.close_calls, 1)
            self.assertTrue(e.handles[0].closed)
            self.assertEqual((e.active_reads, e.active_parsers, e.providers), (0, 0, 0))
            self.assertEqual(self.admission._slots._value, 2)

    async def test_complete_vs_expiry_race_is_atomic_and_leaves_no_tasks(self):
        baseline = asyncio.all_tasks()
        for expire_first in (True, False) * 5:
            e = ScriptedUpload()
            e.feed(HEADER + wav())
            task = await self.start(e)
            await until(lambda: e.written >= len(wav()) and e.active_reads)
            scope = self.scopes[-1]
            if expire_first:
                scope.deadline = current_time()
            e.feed(END, more=False)
            if not expire_first:
                asyncio.get_running_loop().call_soon(setattr, scope, 'deadline', current_time())
            await self.finish(task)
            self.assertIn(e.status, (200, 408))
            self.assertEqual(e.providers, 1 if e.status == 200 else 0)
            self.assertEqual(e.close_calls, 1)
            self.assertEqual(self.admission._slots._value, 2)
        self.assertFalse(asyncio.all_tasks() - baseline)

    async def test_size_bounds_still_reject_fast_large_upload(self):
        for length in (None, 1):
            e = ScriptedUpload(length=length)
            e.feed(HEADER)
            e.feed(b'x' * 2048)
            await self.finish(await self.start(e, self.make_app(settings=test_settings(max_audio_bytes=1024))))
            self.assertEqual((e.status, e.code), (413, 'REQUEST_TOO_LARGE'))
            self.assertEqual((e.materialized, e.providers), (0, 0))
            self.assertLessEqual(e.written, 1024)
            self.assertEqual(self.admission._slots._value, 2)

    async def test_auth_off_rate_denials_create_no_timer_or_admission(self):
        class Deny:
            async def allow(self, *_):
                return False, 60
        for token, enabled, limiter, expected in ((None, True, AllowRate(), 401),
                ('invalid', True, AllowRate(), 401), ('valid-token', False, AllowRate(), 503),
                ('valid-token', True, Deny(), 429)):
            app = self.make_app(settings=test_settings(ai_enabled=enabled), limiter=limiter)
            with patch.object(self.admission, 'run', side_effect=AssertionError('admission')), \
                 patch.object(upload, 'CancelScope', side_effect=AssertionError('timer')):
                e = await ScriptedUpload(token=token).run(app)
            self.assertEqual(e.status, expected)
            self.assertEqual((e.read_calls, e.consumed, e.parsed, e.providers), (0, 0, 0, 0))
        self.assertEqual(self.scopes, [])

    async def test_500_timeout_disconnect_cycles_no_task_fd_spool_growth(self):
        baseline = asyncio.all_tasks()
        fd_dir = '/proc/self/fd' if os.path.isdir('/proc/self/fd') else '/dev/fd'
        fd_before = len(os.listdir(fd_dir))
        refs = []
        with patch.object(upload.BoundedMultipartParser, 'spool_max_size', 1):
            for index in range(500):
                e = ScriptedUpload()
                e.feed(PREFIX_107)
                # No addAsyncCleanup here: completed tasks must not be retained.
                task = asyncio.create_task(e.run(self.app))
                try:
                    await until(lambda: e.consumed == 107 and e.active_reads)
                    if index % 2:
                        e.disconnect()
                    else:
                        # Accelerate the real monotonic timer, not sleep 120s.
                        self.scopes[-1].deadline = current_time()
                    await self.finish(task)
                finally:
                    await self.stop_task(task)
                self.assertEqual(e.status, 422 if index % 2 else 408)
                self.assertEqual(e.close_calls, 1)
                self.assertEqual(self.admission._slots._value, 2)
                self.assertTrue(e.handles[0].closed)
                refs.append(weakref.ref(e.handles[0]))
                self.scopes.clear()
                del e, task
        await asyncio.sleep(0)  # Drain finished gather/ASGI task callbacks.
        gc.collect()
        self.assertTrue(all(ref() is None for ref in refs),
                        [(i, [type(r).__name__ for r in gc.get_referrers(ref())])
                         for i, ref in enumerate(refs) if ref() is not None])
        self.assertFalse(asyncio.all_tasks() - baseline)
        self.assertLessEqual(len(os.listdir(fd_dir)), fd_before)
        self.assertEqual((self.stt.entered, len(self.llm.requests)), (0, 0))
        await self.recovered()

    async def test_timeout_logs_and_response_are_privacy_safe(self):
        logger = logging.getLogger('darin.upload-deadline-test')
        app = self.make_app(.03, privacy_logger=PrivacyLogger(logger, 'synthetic-salt'))
        e = ScriptedUpload()
        e.feed(PREFIX_107 + b'PRIVATE_SYNTHETIC_AUDIO_CONTENT')
        with self.assertLogs(logger, level='INFO') as records:
            await self.finish(await self.start(e, app))
        self.assert_timeout(e)
        self.assertIn('AUDIO_UPLOAD_TIMEOUT', ' '.join(records.output))
        visible = json.dumps(e.messages, default=str) + ' '.join(records.output)
        for private in ('PRIVATE_SYNTHETIC_AUDIO_CONTENT', 'valid-token', 'Authorization',
                        'test-placeholder', 'Traceback', 'Content-Disposition', '/tmp/'):
            self.assertNotIn(private, visible)
        self.assertEqual(self.admission._slots._value, 2)


class UploadDeadlineNetworkTests(unittest.IsolatedAsyncioTestCase):
    async def test_real_uvicorn_stall_and_chunked_drip_then_other_user_recovers(self):
        # Loopback only, including inside --network none Linux containers.
        # Unlike an HTTP client's buffered files= upload, these sockets leave the
        # request open after 107 bytes and after each chunked progress byte.
        for drip in (False, True):
            with self.subTest(drip=drip):
                admission = AudioRequestAdmission()
                stt = NonRetainingStt()
                app = factory.create_app(settings=test_settings(), verifier=Users(),
                    stt_provider=stt, llm_provider=FakeLlmProvider({'events': []}),
                    quota_service=service(), audio_admission=admission,
                    upload_timeout_seconds=.75)
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]
                server = uvicorn.Server(uvicorn.Config(app, host='127.0.0.1', port=port,
                    access_log=False, log_level='error', lifespan='off', timeout_keep_alive=1))
                server_task = asyncio.create_task(server.serve(sockets=[sock]))
                writers, drip_tasks, reads = [], [], []
                stop = asyncio.Event()
                parsed_bytes, active_parsers = [], 0
                original_parse = upload.BoundedMultipartParser.parse
                async def observed_parse(parser):
                    nonlocal active_parsers
                    stream = parser.stream
                    count = [0]
                    parsed_bytes.append(count)
                    async def counted():
                        async for chunk in stream:
                            count[0] += len(chunk)
                            yield chunk
                    parser.stream = counted()
                    active_parsers += 1
                    try:
                        return await original_parse(parser)
                    finally:
                        active_parsers -= 1
                        self.assertTrue(all(handle.closed for handle in parser.owned_files)
                                        or parser.complete)
                async def send_drips(writer):
                    while not stop.is_set():
                        writer.write(b'1\r\nx\r\n')
                        try:
                            await writer.drain()
                        except (ConnectionError, OSError):
                            return
                        await asyncio.sleep(.01)
                try:
                    await until(lambda: server.started or server_task.done())
                    self.assertFalse(server_task.done())
                    with patch.object(upload.BoundedMultipartParser, 'parse', observed_parse):
                        for _ in range(2):
                            reader, writer = await asyncio.open_connection('127.0.0.1', port)
                            writers.append(writer)
                            nonce = auth_headers()['Idempotency-Key']
                            framing = 'Transfer-Encoding: chunked' if drip else 'Content-Length: 1048576'
                            headers = (f'POST /v1/transcribe HTTP/1.1\r\nHost: localhost\r\n'
                                f'Authorization: Bearer attacker\r\nIdempotency-Key: {nonce}\r\n'
                                f'Content-Type: multipart/form-data; boundary=audio\r\n{framing}\r\n\r\n')
                            body = (b'6b\r\n' + PREFIX_107 + b'\r\n') if drip else PREFIX_107
                            writer.write(headers.encode() + body)
                            await writer.drain()
                            reads.append(asyncio.create_task(reader.readuntil(b'\r\n\r\n')))
                            if drip:
                                drip_tasks.append(asyncio.create_task(send_drips(writer)))
                        await until(lambda: active_parsers == 2 and admission._slots._value == 0)
                        async with httpx.AsyncClient(base_url=f'http://127.0.0.1:{port}',
                                                     trust_env=False, timeout=5) as client:
                            # No body supplied by victim: capacity gate must reject now.
                            denied = await client.post('/v1/transcribe', headers=auth_headers('third-user'))
                            self.assertEqual(denied.status_code, 503)
                            self.assertEqual(denied.json()['error']['code'], 'AUDIO_CAPACITY_EXCEEDED')
                            responses = await asyncio.wait_for(asyncio.gather(*reads), 5)
                            stop.set()
                            await asyncio.gather(*drip_tasks)
                            self.assertTrue(all(response.startswith(b'HTTP/1.1 408') for response in responses))
                            self.assertEqual((admission._slots._value, active_parsers, stt.entered), (2, 0, 0))
                            self.assertEqual(len(parsed_bytes), 2)
                            for count in parsed_bytes:
                                if drip:
                                    self.assertGreater(count[0], 107)
                                else:
                                    self.assertEqual(count[0], 107)
                            normal = await client.post('/v1/transcribe', headers=auth_headers('third-user'),
                                files={'file': ('synthetic.wav', wav(), 'audio/wav')})
                            self.assertEqual(normal.status_code, 200)
                            self.assertEqual((admission._slots._value, stt.entered), (2, 1))
                finally:
                    stop.set()
                    for task in drip_tasks + reads:
                        if not task.done():
                            task.cancel()
                    await asyncio.gather(*drip_tasks, *reads, return_exceptions=True)
                    for writer in writers:
                        writer.close()
                    await asyncio.gather(*(w.wait_closed() for w in writers), return_exceptions=True)
                    server.should_exit = True
                    await asyncio.wait_for(server_task, 5)
                    sock.close()
