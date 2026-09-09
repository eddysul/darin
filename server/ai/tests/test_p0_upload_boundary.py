from __future__ import annotations

import asyncio
import unittest
from unittest.mock import patch

from starlette.datastructures import UploadFile

from server.ai.app.factory import create_app
from server.ai.app.upload import BoundedMultipartParser, MULTIPART_OVERHEAD_BYTES
from server.ai.tests.support import FakeLlmProvider, FakeSttProvider, FakeVerifier, VALID_M4A, test_settings


def part(data=VALID_M4A, name='file'):
    return (f'--test\r\nContent-Disposition: form-data; name="{name}"; filename="test.m4a"\r\n'
            'Content-Type: audio/m4a\r\n\r\n').encode() + data + b'\r\n'


class UploadBoundaryTests(unittest.IsolatedAsyncioTestCase):
    async def request(self, chunks, *, token='valid-token', length=None, enabled=True,
                      disconnect=False, cancel=False, limit=1024, denied=False, stt=None,
                      cancel_at_provider=False):
        provider_entered = asyncio.Event()
        class WaitingStt(FakeSttProvider):
            async def transcribe(self, request):
                self.requests.append(request)
                provider_entered.set()
                await asyncio.Event().wait()
        if cancel_at_provider:
            stt = WaitingStt()
        stt = stt or FakeSttProvider()
        llm = FakeLlmProvider({'events': []})
        class Limiter:
            async def allow(self, *_):
                return not denied, 60
        app = create_app(settings=test_settings(max_audio_bytes=limit, ai_enabled=enabled),
                         verifier=FakeVerifier(), stt_provider=stt, llm_provider=llm, limiter=Limiter())
        headers = [(b'content-type', b'multipart/form-data; boundary=test')]
        if token is not None:
            headers.append((b'authorization', f'Bearer {token}'.encode()))
        if length is not None:
            headers.append((b'content-length', str(length).encode()))
        scope = {'type': 'http', 'asgi': {'version': '3.0', 'spec_version': '2.4'},
                 'http_version': '1.1', 'method': 'POST', 'scheme': 'http',
                 'path': '/v1/transcribe', 'raw_path': b'/v1/transcribe', 'query_string': b'',
                 'root_path': '', 'headers': headers, 'server': ('test', 80), 'client': ('test', 123)}
        consumed = 0
        received = 0
        iterator = iter(chunks)
        messages = []
        handles = []
        parser_calls = []
        writes = []
        waiting = asyncio.Event()
        original_headers = BoundedMultipartParser.on_headers_finished
        original_init = BoundedMultipartParser.__init__
        original_write = UploadFile.write
        def capture_headers(parser):
            original_headers(parser)
            handles.extend(f for f in parser.owned_files if f not in handles)
        def capture_init(parser, *args, **kwargs):
            parser_calls.append(True)
            original_init(parser, *args, **kwargs)
        async def capture_write(file, data):
            writes.append(len(data))
            return await original_write(file, data)
        async def receive():
            nonlocal consumed, received
            try:
                data = next(iterator)
            except StopIteration:
                if cancel:
                    waiting.set()
                    await asyncio.Event().wait()
                if disconnect:
                    return {'type': 'http.disconnect'}
                return {'type': 'http.request', 'body': b'', 'more_body': False}
            consumed += len(data)
            received += 1
            return {'type': 'http.request', 'body': data, 'more_body': True}
        async def send(message):
            messages.append(message)
        with patch.object(BoundedMultipartParser, '__init__', capture_init), \
             patch.object(BoundedMultipartParser, 'on_headers_finished', capture_headers), \
             patch.object(BoundedMultipartParser, 'spool_max_size', 64), \
             patch.object(UploadFile, 'write', capture_write):
            task = asyncio.create_task(app(scope, receive, send))
            if cancel or cancel_at_provider:
                await asyncio.wait_for((provider_entered if cancel_at_provider else waiting).wait(), 3)
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task
            else:
                await asyncio.wait_for(task, 3)
        self.assertTrue(all(f.closed for f in handles), 'every owned spool must be closed')
        status = next((m['status'] for m in messages if m['type'] == 'http.response.start'), None)
        return status, consumed, received, len(parser_calls), sum(writes), handles, stt, llm

    async def test_missing_and_invalid_auth_consume_zero_bytes_and_never_parse(self):
        for token in [None, 'invalid-token', 'expired-token']:
            with self.subTest(token=token):
                result = await self.request([part(b'x' * (2 * 1024 * 1024))], token=token)
                self.assertEqual(result[:5], (401, 0, 0, 0, 0))
                self.assertEqual(result[6].requests, [])

    async def test_declared_oversize_rejected_before_read_or_parse(self):
        for length in [1024 + MULTIPART_OVERHEAD_BYTES + 1, '9' * 5000]:
            result = await self.request([part()], length=length)
            self.assertEqual(result[:5], (413, 0, 0, 0, 0))
        for length in ['-1', 'not-a-number']:
            result = await self.request([part()], length=length)
            self.assertEqual(result[:5], (422, 0, 0, 0, 0))

    async def test_kill_switch_and_rate_gate_precede_parsing(self):
        for settings, status in [({'enabled': False}, 503), ({'denied': True}, 429)]:
            result = await self.request([part()], **settings)
            self.assertEqual(result[:5], (status, 0, 0, 0, 0))

    async def test_chunked_without_content_length_succeeds(self):
        body = part(VALID_M4A + b'x' * 100) + b'--test--\r\n'
        result = await self.request([body[i:i+31] for i in range(0, len(body), 31)])
        self.assertEqual(result[0], 200)
        self.assertEqual(result[1], len(body))
        self.assertEqual(len(result[6].requests), 1)
        self.assertTrue(result[5][0]._rolled)

    async def test_actual_file_limit_stops_consumption_and_provider(self):
        body = part(b'x' * 5000) + b'--test--\r\n'
        for length in [None, 1]:
            result = await self.request([body[i:i+256] for i in range(0, len(body), 256)], length=length)
            self.assertEqual(result[0], 413)
            self.assertLess(result[1], len(body))
            self.assertLessEqual(result[4], 1024)
            self.assertTrue(result[5])
            self.assertEqual(result[6].requests, [])

    async def test_total_body_limit_rejects_oversized_asgi_chunk_before_parser_write(self):
        result = await self.request([b'x' * (1024 + MULTIPART_OVERHEAD_BYTES + 1)])
        self.assertEqual(result[0], 413)
        self.assertEqual(result[4], 0)
        self.assertEqual(result[6].requests, [])

    async def test_multiple_files_and_file_count_abuse_close_first_handle(self):
        for count in [2, 20]:
            result = await self.request([part() for _ in range(count)] + [b'--test--\r\n'])
            self.assertEqual(result[0], 422)
            self.assertEqual(len(result[5]), 1)
            self.assertLess(result[2], count + 1)
            self.assertEqual(result[6].requests, [])

    async def test_malformed_and_interrupted_upload_cleanup(self):
        for disconnect in [False, True]:
            result = await self.request([part(VALID_M4A + b'x' * 100)], disconnect=disconnect)
            self.assertEqual(result[0], 422)
            self.assertTrue(result[5])
            self.assertEqual(result[6].requests, [])

    async def test_cancelled_upload_closes_rolled_spool(self):
        result = await self.request([part(VALID_M4A + b'x' * 100)], cancel=True)
        self.assertTrue(result[5])
        self.assertTrue(result[5][0]._rolled)
        self.assertEqual(result[6].requests, [])

    async def test_provider_failure_closes_spool(self):
        result = await self.request([part() + b'--test--\r\n'], stt=FakeSttProvider(RuntimeError('private detail')))
        self.assertEqual(result[0], 502)
        self.assertTrue(result[5])

    async def test_cancel_during_provider_closes_spool(self):
        result = await self.request([part(VALID_M4A + b'x' * 100) + b'--test--\r\n'], cancel_at_provider=True)
        self.assertEqual(len(result[6].requests), 1)
        self.assertTrue(result[5][0]._rolled)
        self.assertEqual(result[7].requests, [])

    async def test_malformed_parser_input_and_invalid_form_fields_close_handles(self):
        bodies = [
            part() + b'--test\r\nnot a header\r\n\r\nx\r\n--test--\r\n',
            part(name='other') + b'--test--\r\n',
            part() + b'--test\r\nContent-Disposition: form-data; name="locale"\r\n\r\ninvalid\r\n--test--\r\n',
            part() + b'--test\r\nContent-Disposition: form-data; name="locale"\r\n\r\nko\r\n'
            b'--test\r\nContent-Disposition: form-data; name="locale"\r\n\r\nen\r\n--test--\r\n',
        ]
        for body in bodies:
            result = await self.request([body])
            self.assertEqual(result[0], 422)
            self.assertTrue(result[5])
            self.assertEqual(result[6].requests, [])


if __name__ == '__main__':
    unittest.main()
