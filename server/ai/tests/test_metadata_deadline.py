"""Real HTTP parser/loopback regressions; never contact actual metadata."""
import concurrent.futures
import contextlib
import json
import socket
import threading
import time
import unittest
from unittest.mock import patch

from google.auth.exceptions import RefreshError
from server.ai.app.quota.workload_credentials import (
    FixedMetadataTransport, FixedMetadataWorkloadCredentials,
    WorkloadCredentialError, METADATA_HOST, METADATA_PORT,
)

SA = "synthetic-runtime@synthetic-project.iam.gserviceaccount.com"


class Peer:
    def __init__(self, mode):
        self.mode = mode
        self.stop = threading.Event()
        self.listener = socket.socket()
        self.listener.bind(("127.0.0.1", 0))
        self.listener.listen(32)
        self.listener.settimeout(.05)
        self.address = self.listener.getsockname()
        self.workers = []
        self.connections = []
        self.requests = []
        self.thread = threading.Thread(target=self.accept)
        self.thread.start()

    def accept(self):
        while not self.stop.is_set():
            try:
                conn, _ = self.listener.accept()
            except socket.timeout:
                continue
            except OSError:
                break
            self.connections.append(conn)
            worker = threading.Thread(target=self.serve, args=(conn,))
            self.workers.append(worker)
            worker.start()

    def serve(self, conn):
        try:
            conn.settimeout(3)
            request = b""
            while b"\r\n\r\n" not in request:
                chunk = conn.recv(4096)
                if not chunk:
                    return
                request += chunk
            self.requests.append(request)
            mode = self.mode
            if mode == "reject":
                conn.sendall(b"HTTP/1.1 302 Found\r\nLocation: http://attacker.invalid/\r\nContent-Length: 0\r\n\r\n")
                return
            if mode == "valid" or mode == "token-stall" and b"/email " in request:
                body = (SA.encode() if b"/email " in request else
                        json.dumps(dict(access_token="synthetic-token", expires_in=1200,
                                        token_type="Bearer")).encode())
                conn.sendall(b"HTTP/1.1 200 OK\r\nMetadata-Flavor: Google\r\nContent-Length: "
                             + str(len(body)).encode() + b"\r\n\r\n" + body)
                return
            if mode == "trailers":
                conn.sendall(b"HTTP/1.1 200 OK\r\nMetadata-Flavor: Google\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n")
            if mode in ("body-stall", "body-drip", "token-stall"):
                conn.sendall(b"HTTP/1.1 200 OK\r\nMetadata-Flavor: Google\r\nContent-Length: 200\r\n\r\n")
            if mode == "header-drip":
                conn.sendall(b"HTTP/1.1 200 OK\r\nX-Slow: ")
            while not self.stop.wait(.05):
                if mode == "interim":
                    conn.sendall(b"HTTP/1.1 100 Continue\r\n\r\n")
                elif mode == "trailers":
                    conn.sendall(b"X-Trailer: a\r\n")
                elif mode in ("header-drip", "body-drip"):
                    conn.sendall(b"a")
        except OSError:
            pass
        finally:
            conn.close()

    def close(self):
        self.stop.set()
        self.thread.join(1)
        self.listener.close()
        for conn in self.connections:
            with contextlib.suppress(OSError):
                conn.shutdown(socket.SHUT_RDWR)
        for worker in self.workers:
            worker.join(1)
            assert not worker.is_alive()


class MetadataDeadlineTests(unittest.TestCase):
    @contextlib.contextmanager
    def peer(self, mode):
        peer = Peer(mode)
        connect = socket.create_connection
        clients = []

        def local_only(address, timeout=socket._GLOBAL_DEFAULT_TIMEOUT,
                       source_address=None, **kwargs):
            self.assertEqual(address, (METADATA_HOST, METADATA_PORT))
            conn = connect(peer.address, timeout, source_address, **kwargs)
            clients.append(conn)
            return conn

        try:
            with patch("socket.create_connection", side_effect=local_only):
                yield peer, clients
        finally:
            peer.close()
            self.assertTrue(all(conn.fileno() == -1 for conn in clients))

    def test_absolute_deadline_covers_interim_trailers_and_slow_drips(self):
        for mode in ("interim", "trailers", "header-drip", "body-drip",
                     "header-stall", "body-stall"):
            with self.subTest(mode=mode), self.peer(mode):
                started = time.monotonic()
                with self.assertRaises(WorkloadCredentialError):
                    FixedMetadataTransport().service_account_email()
                self.assertLess(time.monotonic() - started, 3.0)

    def test_token_deadline_clears_previous_token_and_releases_lock(self):
        with self.peer("valid") as (peer, clients):
            credential = FixedMetadataWorkloadCredentials(SA)
            credential.refresh(None)
            self.assertTrue(credential.valid)
            peer.mode = "token-stall"
            started = time.monotonic()
            with self.assertRaises(RefreshError):
                credential.refresh(None)
            self.assertLess(time.monotonic() - started, 3.0)
            self.assertIsNone(credential.token)
            self.assertIsNone(credential.expiry)
            self.assertFalse(credential.valid)
            peer.mode = "valid"
            credential.refresh(None)
            self.assertTrue(credential.valid)

    def test_concurrent_waiters_terminate_and_recovery_succeeds(self):
        with self.peer("interim") as (peer, clients):
            credential = FixedMetadataWorkloadCredentials(SA)
            def refresh():
                with self.assertRaises(RefreshError):
                    credential.refresh(None)
            started = time.monotonic()
            with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
                list(pool.map(lambda _: refresh(), range(12)))
            self.assertLess(time.monotonic() - started, 7.0)
            self.assertIsNone(credential.token)
            peer.mode = "valid"
            credential.refresh(None)
            self.assertTrue(credential.valid)

    def test_repeated_success_and_failure_close_all_socket_references(self):
        with self.peer("valid") as (peer, clients):
            for _ in range(100):
                peer.mode = "valid"
                FixedMetadataWorkloadCredentials(SA).refresh(None)
                peer.mode = "reject"
                with self.assertRaises(WorkloadCredentialError):
                    FixedMetadataTransport().service_account_email()
            self.assertTrue(all(conn.fileno() == -1 for conn in clients))
            self.assertEqual(len(clients), 300)

    def test_connect_stall_is_bounded_and_releases_socket(self):
        listener = socket.socket()
        listener.bind(("127.0.0.1", 0))
        listener.listen(0)
        connect = socket.create_connection
        blocker = connect(listener.getsockname(), timeout=1)
        def local_only(address, timeout, source_address=None):
            self.assertEqual(address, (METADATA_HOST, METADATA_PORT))
            return connect(listener.getsockname(), timeout, source_address)
        try:
            started = time.monotonic()
            with patch("socket.create_connection", side_effect=local_only):
                with self.assertRaises(WorkloadCredentialError):
                    FixedMetadataTransport().service_account_email()
            self.assertLess(time.monotonic() - started, 3.0)
        finally:
            blocker.close()
            listener.close()

    def test_waiter_timeout_does_not_mutate_lock_owner_token(self):
        credential = FixedMetadataWorkloadCredentials(SA)
        credential.token = "synthetic-owner-token"
        credential._refresh_lock.acquire()
        try:
            with patch("server.ai.app.quota.workload_credentials.METADATA_TIMEOUT_SECONDS", .01):
                with self.assertRaises(RefreshError):
                    credential.refresh(None)
            self.assertEqual(credential.token, "synthetic-owner-token")
        finally:
            credential._refresh_lock.release()
