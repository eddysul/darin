from __future__ import annotations

import base64
import asyncio
import concurrent.futures
import json
import unittest
from dataclasses import replace
from unittest.mock import patch, mock_open

import httpx
from google.auth.credentials import AnonymousCredentials
from google.auth.exceptions import RefreshError
from google.oauth2.credentials import Credentials as AuthorizedUserCredentials
from google.cloud.firestore_v1 import Client

from server.ai.app.factory import create_app
from server.ai.app.errors import AppError
from server.ai.app.quota.composition import (CentralConfig, CompositionError, BoundRepository,
    central_service, compose_quota, firestore_client)
from server.ai.app.quota.workload_credentials import (
    FixedMetadataTransport,
    FixedMetadataWorkloadCredentials,
    IDENTITY_MAX_BYTES,
    METADATA_HOST,
    METADATA_PORT,
    METADATA_PREFIX,
    METADATA_TIMEOUT_SECONDS,
    TOKEN_MAX_BYTES,
    WorkloadCredentialError,
)
from server.ai.app.quota.harness import exercise
from server.ai.app.telemetry import Telemetry
from server.ai.app.telemetry import METRICS, memory_snapshot
from server.ai.app.audio_admission import AudioRequestAdmission
from server.ai.tests.quota_fake import KEYS, config
from server.ai.tests.support import test_settings, FakeVerifier, FakeLlmProvider, FakeSttProvider, consult_body
from server.ai.tests.test_quota_firestore import FakeGapic


def environment():
    return {"DARIN_QUOTA_MODE": "central", "DARIN_EXECUTION_ENVIRONMENT": "synthetic-staging",
        "DARIN_QUOTA_PROJECT_ID": "synthetic-quota-project", "DARIN_QUOTA_DATABASE_ID": "synthetic-ledger",
        "DARIN_QUOTA_ENVIRONMENT": "synthetic-staging", "DARIN_QUOTA_NAMESPACE": "synthetic-issuer",
        "DARIN_QUOTA_CONFIG_DOCUMENT": "control/current", "DARIN_QUOTA_SCHEMA_VERSION": "p1.2.v1",
        "DARIN_QUOTA_CONFIG_VERSION": "c1", "DARIN_QUOTA_ACTIVE_KEY_VERSION": "k1",
        "DARIN_QUOTA_HISTORICAL_KEY_VERSIONS": '["k2"]',
        "DARIN_RUNTIME_SERVICE_ACCOUNT": "darin-ai-v2-staging-runtime@darin-childcare-auth.iam.gserviceaccount.com",
        "DARIN_QUOTA_KEYRING_FILE": "/synthetic-mounted-keyring.json"}


def keyring():
    return json.dumps({k: base64.b64encode(v).decode() for k, v in KEYS.items()}).encode()


class ScriptedMetadata:
    def __init__(self, identities=(), tokens=()):
        self.identities = list(identities)
        self.tokens = list(tokens)
        self.identity_calls = 0
        self.token_calls = []

    def service_account_email(self):
        self.identity_calls += 1
        value = self.identities.pop(0)
        if isinstance(value, BaseException):
            raise value
        return value

    def access_token(self, service_account_email):
        self.token_calls.append(service_account_email)
        value = self.tokens.pop(0)
        if isinstance(value, BaseException):
            raise value
        return value


class MetadataResponse:
    def __init__(self, data, *, status=200, flavor="Google", content_length=None):
        self.data = data
        self.status = status
        self.headers = {
            "Metadata-Flavor": flavor,
            "Content-Length": str(len(data)) if content_length is None else content_length,
        }
        self.read_limit = None
        self.closed = False

    def getheader(self, name):
        return self.headers.get(name)

    def read(self, limit):
        self.read_limit = limit
        return self.data[:limit]

    def close(self):
        self.closed = True


class MetadataConnections:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.destinations = []
        self.requests = []
        self.closed = 0

    def __call__(self, host, port, *, timeout):
        self.destinations.append((host, port, timeout))
        owner = self
        response = self.responses.pop(0)

        class Connection:
            def request(self, method, path, *, headers):
                owner.requests.append((method, path, dict(headers)))

            def getresponse(self):
                return response

            def close(self):
                owner.closed += 1

        return Connection()


def metadata(identity=None, *, tokens=()):
    return ScriptedMetadata(
        identities=[identity or environment()["DARIN_RUNTIME_SERVICE_ACCOUNT"]],
        tokens=tokens,
    )


class CompositionTests(unittest.TestCase):
    def test_all_required_metadata_missing_or_malformed_rejects(self):
        for key in environment():
            if key == "DARIN_QUOTA_MODE": continue
            env = environment(); del env[key]
            with self.subTest(key=key), self.assertRaises(CompositionError):
                CentralConfig.parse(env)
        for key, value in [("DARIN_QUOTA_PROJECT_ID", "bad/path"),
            ("DARIN_QUOTA_DATABASE_ID", "(default)"), ("DARIN_QUOTA_ENVIRONMENT", "production"),
            ("DARIN_QUOTA_SCHEMA_VERSION", "p1.3"), ("DARIN_QUOTA_CONFIG_DOCUMENT", "other/current"),
            ("DARIN_QUOTA_HISTORICAL_KEY_VERSIONS", '["k2","k2"]'),
            ("DARIN_QUOTA_HISTORICAL_KEY_VERSIONS", '"k2"'),
            ("DARIN_QUOTA_HISTORICAL_KEY_VERSIONS", '["k1"]'),
            ("DARIN_QUOTA_KEYRING_FILE", "relative")]:
            env = {**environment(), key: value}
            with self.subTest(key=key), self.assertRaises(CompositionError): CentralConfig.parse(env)

    def test_keyring_rejects_missing_history_duplicates_oversize_short_invalid(self):
        cfg = CentralConfig.parse(environment())
        for raw in [b'{}', b'{"k1":"x"}', b'{"k1":"x","k1":"y"}', b'x' * 16385,
                    json.dumps({"k1":"YWJj", "k2":"YWJj"}).encode(),
                    keyring().replace(b'"k2"', b'"k3"')]:
            with patch("builtins.open", mock_open(read_data=raw)), self.assertRaises(CompositionError) as e:
                cfg.fingerprints()
            self.assertEqual(str(e.exception), "Central quota runtime configuration is invalid.")
        with patch("builtins.open", mock_open(read_data=keyring())):
            keys = cfg.fingerprints()
            for version in KEYS: self.assertEqual(len(keys.calculate(version, b"test")), 64)
        self.assertNotIn(cfg.keyring_file, repr(cfg))

    def test_bootstrap_off_is_explicit_and_cannot_enable(self):
        compose_quota(False, env={"DARIN_QUOTA_MODE": "bootstrap-off"})
        for enabled, env in [(True, {"DARIN_QUOTA_MODE":"bootstrap-off"}), (False, {}),
            (False, {"DARIN_QUOTA_MODE":"bootstrap-off", "DARIN_QUOTA_PROJECT_ID":"invalid"})]:
            with self.assertRaises(CompositionError): compose_quota(enabled, env=env)

    def test_cross_project_named_database_adc_constructor(self):
        cfg = CentralConfig.parse(environment())
        with patch.dict("os.environ", {"GOOGLE_CLOUD_PROJECT":"different-runtime-project"}, clear=True), \
             patch("google.cloud.firestore.Client") as constructor:
            credentials = firestore_client(cfg, metadata_transport=metadata())
            self.assertEqual(credentials, constructor.return_value)
            constructor.assert_called_once()
            kwargs = constructor.call_args.kwargs
            self.assertEqual((kwargs["project"], kwargs["database"]), (cfg.project, cfg.database))
            self.assertIsInstance(kwargs["credentials"], FixedMetadataWorkloadCredentials)
            self.assertEqual(kwargs["credentials"].service_account_email, cfg.runtime_service_account)

    def test_real_firestore_client_accepts_fixed_credentials_without_adc(self):
        cfg = CentralConfig.parse(environment())
        with patch.dict("os.environ", {"GOOGLE_CLOUD_PROJECT":"different-runtime-project"}, clear=True), \
             patch("google.auth.default", side_effect=AssertionError("ADC forbidden")) as adc:
            client = firestore_client(cfg, metadata_transport=metadata())
        self.assertEqual(adc.call_count, 0)
        self.assertEqual((client.project, client._database), (cfg.project, cfg.database))
        self.assertIsInstance(client._credentials, FixedMetadataWorkloadCredentials)

    def test_no_static_credentials_or_emulator_runtime(self):
        for key in ["GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST"]:
            for value in ["synthetic", ""]:
                with self.subTest(key=key, value=value), patch.dict("os.environ", {key:value}, clear=True), self.assertRaises(CompositionError):
                    firestore_client(CentralConfig.parse(environment()), metadata_transport=metadata())

    def test_client_failure_redacted_even_ai_off(self):
        def broken(_, __): raise RuntimeError("SECRET_SYNTHETIC_CANARY")
        with patch("builtins.open", mock_open(read_data=keyring())), self.assertRaises(CompositionError) as e:
            compose_quota(False, env=environment(), client_factory=broken,
                          metadata_transport=metadata())
        self.assertNotIn("CANARY", str(e.exception))

    def test_user_authorized_adc_is_never_consulted_or_accepted(self):
        cfg = CentralConfig.parse(environment())
        user_adc = AuthorizedUserCredentials(token="synthetic-authorized-user-token")
        with patch("google.auth.default", return_value=(user_adc, "ambient-user-project")) as generic, \
             patch("google.cloud.firestore.Client") as constructor:
            client = firestore_client(cfg, metadata_transport=metadata())
        self.assertIs(client, constructor.return_value)
        self.assertEqual(generic.call_count, 0)
        self.assertEqual(constructor.call_args.kwargs["credentials"].service_account_email,
                         cfg.runtime_service_account)

    def test_metadata_boundary_uses_fixed_host_header_and_bounded_read(self):
        expected = environment()["DARIN_RUNTIME_SERVICE_ACCOUNT"]
        response = MetadataResponse(expected.encode() + b"\n")
        connections = MetadataConnections(response)
        transport = FixedMetadataTransport(connection_factory=connections)
        self.assertEqual(transport.service_account_email(), expected)
        self.assertEqual(connections.destinations,
                         [(METADATA_HOST, METADATA_PORT, METADATA_TIMEOUT_SECONDS)])
        self.assertEqual(connections.requests,
                         [("GET", METADATA_PREFIX + "default/email",
                           {"Metadata-Flavor":"Google"})])
        self.assertEqual(response.read_limit, IDENTITY_MAX_BYTES + 1)
        self.assertTrue(response.closed)
        self.assertEqual(connections.closed, 1)

    def test_metadata_identity_wire_format_is_strict_and_bounded(self):
        expected = environment()["DARIN_RUNTIME_SERVICE_ACCOUNT"].encode()
        accepted = [expected, expected + b"\n", expected + b"\r\n"]
        rejected = [b" " + expected, b"\t" + expected, b"\n" + expected,
                    expected + b" ", expected[:5] + b"\n" + expected[5:],
                    expected + b"\nother@darin-childcare-auth.iam.gserviceaccount.com",
                    expected + b"\x00", b"x" * (IDENTITY_MAX_BYTES + 1), b"\xff" * 10,
                    b"darin-ai-v2-staging-runtime@example.com"]
        for raw in accepted:
            connections = MetadataConnections(MetadataResponse(raw))
            with self.subTest(raw=raw):
                self.assertEqual(FixedMetadataTransport(
                    connection_factory=connections).service_account_email(), expected.decode())
        for raw in rejected:
            connections = MetadataConnections(MetadataResponse(raw))
            with self.subTest(raw=raw), self.assertRaises(WorkloadCredentialError):
                FixedMetadataTransport(connection_factory=connections).service_account_email()

    def test_metadata_transport_wins_when_authorized_user_adc_is_present(self):
        cfg = CentralConfig.parse(environment())
        user_adc = AuthorizedUserCredentials(token="synthetic-authorized-user-token")
        with patch("google.auth.default", return_value=(user_adc, "ambient-user-project")) as generic, \
             patch("google.cloud.firestore.Client") as constructor:
            firestore_client(cfg, metadata_transport=metadata())
        self.assertEqual(generic.call_count, 0)
        self.assertEqual(constructor.call_args.kwargs["credentials"].service_account_email,
                         cfg.runtime_service_account)

    def test_wrong_or_default_compute_workload_identity_rejects(self):
        cfg = CentralConfig.parse(environment())
        for actual in ["other-runtime@darin-childcare-auth.iam.gserviceaccount.com",
                       "1021237169934-compute@developer.gserviceaccount.com", "malformed"]:
            with self.subTest(actual=actual), self.assertRaises(CompositionError):
                firestore_client(cfg, metadata_transport=metadata(actual))

    def test_missing_expected_runtime_identity_rejects_in_central_mode(self):
        env = environment(); env.pop("DARIN_RUNTIME_SERVICE_ACCOUNT")
        with self.assertRaises(CompositionError): CentralConfig.parse(env)

    def test_metadata_unavailable_has_no_adc_fallback(self):
        cfg = CentralConfig.parse(environment())
        with patch("google.auth.default", side_effect=AssertionError("ADC fallback")) as generic, \
             self.assertRaises(CompositionError):
            firestore_client(cfg, metadata_transport=ScriptedMetadata([OSError("metadata")]))
        self.assertEqual(generic.call_count, 0)

    def test_service_account_format_and_metadata_response_are_bounded(self):
        cfg = CentralConfig.parse(environment())
        for actual in ["user@example.com", "A" * 257 + "@x.iam.gserviceaccount.com"]:
            with self.subTest(actual=actual), self.assertRaises(CompositionError):
                firestore_client(cfg, metadata_transport=metadata(actual))

    def test_credential_error_is_redacted(self):
        cfg = CentralConfig.parse(environment())
        with self.assertRaises(CompositionError) as error:
            firestore_client(cfg, metadata_transport=ScriptedMetadata(
                [RuntimeError("TOKEN_OR_ADC_PATH_CANARY")]))
        self.assertNotIn("TOKEN", str(error.exception))
        self.assertNotIn("ADC", str(error.exception))

    def test_gce_metadata_overrides_are_rejected_before_transport(self):
        cfg = CentralConfig.parse(environment())
        for name, configured_value in [
            ("GCE_METADATA_HOST", "attacker.example"),
            ("GCE_METADATA_ROOT", "http://attacker.example/"),
            ("GCE_METADATA_IP", "203.0.113.10"),
        ]:
            for value in [configured_value, ""]:
                transport = metadata()
                with self.subTest(name=name, value=value), \
                     patch.dict("os.environ", {name:value}, clear=True), \
                     self.assertRaises(CompositionError):
                    firestore_client(cfg, metadata_transport=transport)
                self.assertEqual(transport.identity_calls, 0)

    def test_proxy_environment_cannot_change_fixed_transport_destination(self):
        expected = environment()["DARIN_RUNTIME_SERVICE_ACCOUNT"]
        identity = MetadataResponse(expected.encode())
        token = MetadataResponse(json.dumps({"access_token":"token-a", "expires_in":1200,
                                             "token_type":"Bearer"}).encode())
        connections = MetadataConnections(identity, token)
        credential = FixedMetadataWorkloadCredentials(expected,
            transport=FixedMetadataTransport(connection_factory=connections))
        proxies = {name:"http://attacker.example:8080" for name in
            ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy")}
        with patch.dict("os.environ", proxies, clear=True), \
             patch("google.auth.default", side_effect=AssertionError("ADC forbidden")) as adc:
            credential.refresh(None)
        self.assertEqual(adc.call_count, 0)
        self.assertEqual(connections.destinations,
            [(METADATA_HOST, METADATA_PORT, METADATA_TIMEOUT_SECONDS)] * 2)
        self.assertTrue(all(request[2] == {"Metadata-Flavor":"Google"}
                            for request in connections.requests))

    def test_redirects_and_wrong_metadata_flavor_fail_without_following(self):
        expected = environment()["DARIN_RUNTIME_SERVICE_ACCOUNT"]
        for status in [301, 302, 303, 307, 308]:
            response = MetadataResponse(b"", status=status)
            response.headers["Location"] = "http://attacker.example/metadata"
            connections = MetadataConnections(response)
            with self.subTest(status=status), self.assertRaises(WorkloadCredentialError):
                FixedMetadataTransport(connection_factory=connections).service_account_email()
            self.assertEqual(len(connections.destinations), 1)
            self.assertEqual(len(connections.requests), 1)
        for flavor in [None, "NotGoogle", "google"]:
            response = MetadataResponse(expected.encode(), flavor=flavor)
            connections = MetadataConnections(response)
            with self.subTest(flavor=flavor), self.assertRaises(WorkloadCredentialError):
                FixedMetadataTransport(connection_factory=connections).service_account_email()

    def test_refresh_revalidates_identity_and_binds_explicit_token_endpoint(self):
        expected = environment()["DARIN_RUNTIME_SERVICE_ACCOUNT"]
        wrong = "other-runtime@darin-childcare-auth.iam.gserviceaccount.com"
        transport = ScriptedMetadata(
            identities=[expected, wrong],
            tokens=[("token-a", 1200)],
        )
        credential = FixedMetadataWorkloadCredentials(expected, transport=transport)
        credential.refresh(None)
        self.assertEqual(credential.token, "token-a")
        self.assertEqual(transport.token_calls, [expected])
        with self.assertRaises(RefreshError) as error:
            credential.refresh(None)
        self.assertIsNone(credential.token)
        self.assertIsNone(credential.expiry)
        self.assertEqual(transport.token_calls, [expected])
        self.assertNotIn(expected, str(error.exception))

    def test_refresh_ignores_authorized_user_and_fails_closed_on_outage(self):
        expected = environment()["DARIN_RUNTIME_SERVICE_ACCOUNT"]
        user_adc = AuthorizedUserCredentials(token="synthetic-authorized-user-token")
        good = ScriptedMetadata([expected], [("token-a", 1200)])
        with patch("google.auth.default", return_value=(user_adc, "ambient")) as adc:
            FixedMetadataWorkloadCredentials(expected, transport=good).refresh(None)
        self.assertEqual(adc.call_count, 0)
        unavailable = ScriptedMetadata([OSError("SENSITIVE_METADATA_CANARY")])
        credential = FixedMetadataWorkloadCredentials(expected, transport=unavailable)
        with patch("google.auth.default", side_effect=AssertionError("ADC fallback")) as adc, \
             self.assertRaises(RefreshError) as error:
            credential.refresh(None)
        self.assertEqual(adc.call_count, 0)
        self.assertIsNone(credential.token)
        self.assertNotIn("CANARY", str(error.exception))

    def test_token_response_is_bounded_strict_and_privacy_safe(self):
        expected = environment()["DARIN_RUNTIME_SERVICE_ACCOUNT"]
        valid = json.dumps({"access_token":"token-a", "expires_in":3600,
                            "token_type":"Bearer"}).encode()
        identity = MetadataResponse(expected.encode())
        token_response = MetadataResponse(valid)
        connections = MetadataConnections(identity, token_response)
        credential = FixedMetadataWorkloadCredentials(expected,
            transport=FixedMetadataTransport(connection_factory=connections))
        credential.refresh(None)
        self.assertEqual(credential.token, "token-a")
        self.assertEqual(token_response.read_limit, TOKEN_MAX_BYTES + 1)
        token_path = connections.requests[1][1]
        self.assertEqual(token_path,
            METADATA_PREFIX + expected.replace("@", "%40") + "/token")
        invalid = [
            b"{}",
            b'{"access_token":"a","access_token":"b","expires_in":1,"token_type":"Bearer"}',
            b'{"access_token":"a","expires_in":0,"token_type":"Bearer"}',
            b'{"access_token":"a","expires_in":3601,"token_type":"Bearer"}',
            b'{"access_token":"a","expires_in":1.0,"token_type":"Bearer"}',
            b'{"access_token":"a b","expires_in":1,"token_type":"Bearer"}',
            b'{"access_token":"a","expires_in":1,"token_type":"bearer"}',
            b'{"access_token":"a","expires_in":1,"token_type":"Bearer","extra":1}',
            b"x" * (TOKEN_MAX_BYTES + 1),
        ]
        for raw in invalid:
            connections = MetadataConnections(MetadataResponse(expected.encode()),
                                               MetadataResponse(raw))
            candidate = FixedMetadataWorkloadCredentials(expected,
                transport=FixedMetadataTransport(connection_factory=connections))
            with self.subTest(raw=raw[:20]), self.assertRaises(RefreshError) as error:
                candidate.refresh(None)
            self.assertIsNone(candidate.token)
            self.assertNotIn("token-a", str(error.exception))
        oversized_without_length = MetadataResponse(b"x" * (TOKEN_MAX_BYTES + 1))
        oversized_without_length.headers.pop("Content-Length")
        connections = MetadataConnections(MetadataResponse(expected.encode()),
                                           oversized_without_length)
        candidate = FixedMetadataWorkloadCredentials(expected,
            transport=FixedMetadataTransport(connection_factory=connections))
        with self.assertRaises(RefreshError):
            candidate.refresh(None)
        self.assertEqual(oversized_without_length.read_limit, TOKEN_MAX_BYTES + 1)
        self.assertIsNone(candidate.token)

    def test_concurrent_refreshes_are_serialized_without_identity_cross_assignment(self):
        expected = environment()["DARIN_RUNTIME_SERVICE_ACCOUNT"]
        count = 20
        transport = ScriptedMetadata(
            identities=[expected] * count,
            tokens=[("token-" + str(index), 1200) for index in range(count)],
        )
        credential = FixedMetadataWorkloadCredentials(expected, transport=transport)
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(lambda _: credential.refresh(None), range(count)))
        self.assertEqual(transport.identity_calls, count)
        self.assertEqual(transport.token_calls, [expected] * count)
        self.assertIn(credential.token, {"token-" + str(index) for index in range(count)})
        self.assertIsNotNone(credential.expiry)


class RuntimeTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.cfg = CentralConfig.parse(environment())
        self.client = Client(project=self.cfg.project, database=self.cfg.database, credentials=AnonymousCredentials())
        self.rpc = FakeGapic(self.client)
        self.rpc.data["control/current"] = config(environment=self.cfg.environment,
                                                  identity_namespace=self.cfg.namespace)
        self.client._firestore_api_internal = self.rpc
        with patch("builtins.open", mock_open(read_data=keyring())):
            self.service = central_service(self.cfg,
                client_factory=lambda _, credentials: self.client,
                metadata_transport=metadata())

    async def test_composed_repository_uses_real_sdk_without_network(self):
        self.assertIsInstance(self.service.repository, BoundRepository)
        self.assertEqual((await self.service.repository.configuration()).version, "c1")
        self.assertFalse(any(p.startswith("reservations/") for p in self.rpc.data))

    async def test_pinned_control_mismatch_and_malformed_fail_closed(self):
        valid = dict(self.rpc.data["control/current"])
        for changes in [{"version":"c2"}, {"environment":"production"}, {"fingerprint_version":"k2"},
                        {"contract":"wrong"}, {"user_budget":2_000_000_000}, {"global_budget":-1},
                        {"identity_namespace":"wrong"}, {"enabled":False}]:
            self.rpc.data["control/current"] = {**valid, **changes}
            with self.subTest(changes=changes), self.assertRaises(AppError):
                await self.service.repository.configuration()
        del self.rpc.data["control/current"]
        with self.assertRaises(AppError): await self.service.repository.configuration()

    async def test_default_runtime_ai_off_health_auth_zero_ledger_zero_provider(self):
        llm, stt = FakeLlmProvider(), FakeSttProvider()
        with patch("server.ai.app.factory.Settings.from_env", return_value=test_settings(ai_enabled=False)), \
             patch.dict("os.environ", environment(), clear=True), \
             patch("builtins.open", mock_open(read_data=keyring())), \
             patch("server.ai.app.quota.composition.firestore_client", return_value=self.client):
            app = create_app(verifier=FakeVerifier(), llm_provider=llm, stt_provider=stt)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            self.assertEqual((await client.get("/health")).json(), {"status":"ok"})
            self.assertEqual((await client.get("/version")).json()["commit"], "abc1234")
            for path in ["/v1/ai/execute", "/v1/transcribe"]:
                self.assertEqual((await client.post(path)).status_code, 401)
                result = await client.post(path, headers={"Authorization":"Bearer valid-token"})
                self.assertEqual(result.json()["error"]["code"], "AI_DISABLED")
        self.assertEqual(self.rpc.calls, [])
        self.assertFalse(llm.requests or stt.requests)
        self.assertEqual(await app.state.quota_readiness(), {"central_ready":True,"ai_enabled":False})
        self.assertEqual(set(self.rpc.data), {"control/current"})

    async def test_store_outage_cannot_invoke_provider(self):
        llm = FakeLlmProvider()
        app = create_app(settings=test_settings(), verifier=FakeVerifier(), llm_provider=llm,
                         quota_service=self.service)
        with patch.object(self.rpc, "begin_transaction", side_effect=PermissionError("secret-canary")):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                response = await client.post("/v1/ai/execute", headers={"Authorization":"Bearer valid-token"},
                    json=consult_body())
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.json()["error"]["code"], "CENTRAL_QUOTA_UNAVAILABLE")
            # Check actual service gate independent of request schema validation.
            with self.assertRaises(AppError): await self.service.repository.configuration()
            self.assertFalse((await app.state.quota_readiness())["central_ready"])
        self.assertFalse(llm.requests)
        self.assertNotIn("secret-canary", response.text)

    async def test_enabled_composed_route_reserves_before_fake_dispatch(self):
        llm = FakeLlmProvider({"claim_type":"record_references", "fact_indexes":[0]})
        with patch("server.ai.app.factory.Settings.from_env", return_value=test_settings()), \
             patch.dict("os.environ", environment(), clear=True), \
             patch("builtins.open", mock_open(read_data=keyring())), \
             patch("server.ai.app.quota.composition.firestore_client", return_value=self.client):
            app = create_app(verifier=FakeVerifier(), llm_provider=llm)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/v1/ai/execute", json=consult_body(), headers={
                "Authorization":"Bearer valid-token", "Idempotency-Key":"20260909." + "a" * 32})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(llm.requests), 1)
        records = [v for k, v in self.rpc.data.items() if k.startswith("reservations/")]
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["stages"][0]["state"], "SETTLED")

    async def test_missing_and_malformed_control_reject_actual_route(self):
        for raw in [None, {}, {**self.rpc.data["control/current"], "environment":"production"}]:
            if raw is None: self.rpc.data.pop("control/current", None)
            else: self.rpc.data["control/current"] = raw
            llm = FakeLlmProvider()
            app = create_app(settings=test_settings(), verifier=FakeVerifier(), llm_provider=llm,
                             quota_service=self.service)
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                response = await client.post("/v1/ai/execute", json=consult_body(), headers={
                    "Authorization":"Bearer valid-token", "Idempotency-Key":"20260909." + "b" * 32})
            self.assertEqual(response.status_code, 503)
            self.assertFalse(llm.requests)
            self.assertFalse(any(k.startswith("reservations/") for k in self.rpc.data))

    async def test_admission_metrics_release_on_cancellation(self):
        before = METRICS.snapshot()["metrics"]["audio_active"]
        admission = AudioRequestAdmission(1)
        ready = asyncio.Event()
        async def wait():
            ready.set()
            await asyncio.Event().wait()
        task = asyncio.create_task(admission.run(wait))
        await ready.wait()
        self.assertEqual(METRICS.snapshot()["metrics"]["audio_active"], before + 1)
        with self.assertRaises(AppError): await admission.run(wait)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError): await task
        self.assertEqual(METRICS.snapshot()["metrics"]["audio_active"], before)
        sample = memory_snapshot()
        self.assertTrue(all(sample[k] is None or type(sample[k]) is int for k in
                            ("rss_bytes", "cgroup_bytes", "tmp_filesystem_used_bytes")))

    async def test_harness_real_sdk_synthetic_only_no_provider_or_delete(self):
        with patch("server.ai.app.providers.OpenAiLlmProvider", side_effect=AssertionError("provider forbidden")), \
             patch("server.ai.app.providers.OpenAiSttProvider", side_effect=AssertionError("provider forbidden")):
            result = await exercise(self.cfg, self.service, faults=True)
        self.assertEqual(result["result"], "PASS")
        self.assertEqual(result["provider_calls"], 0)
        self.assertIn("marker_corruption", result["checks"])
        self.assertTrue(all(path == "control/current" or path.startswith("syntheticRuns/") for path in self.rpc.data))
        self.assertTrue(set(self.rpc.calls) <= {"begin","read","commit","rollback"})

    async def test_harness_refuses_runtime_database_before_reads(self):
        for field in ["database", "namespace", "environment"]:
            with self.assertRaises(RuntimeError):
                await exercise(replace(self.cfg, **{field:"production"}), self.service)
        self.assertEqual(self.rpc.calls, [])

    async def test_observability_bounded_content_free(self):
        telemetry = Telemetry()
        for i in range(1000): telemetry.add("sensitive-input-" + str(i))
        telemetry.add("audio_active", 1)
        telemetry.add("provider_dispatch")
        snapshot = telemetry.snapshot()
        self.assertEqual(snapshot["metrics"]["audio_active"], 1)
        self.assertEqual(snapshot["metrics"]["provider_dispatch"], 1)
        self.assertNotIn("sensitive", json.dumps(snapshot))
        self.assertLess(len(snapshot["metrics"]), 64)
