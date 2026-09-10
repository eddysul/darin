from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
import json
import unittest

from fastapi.testclient import TestClient

from server.ai.app.auth import SupabaseJwksVerifier
from server.ai.tests.support import create_app
from server.ai.app.rate_limit import InMemoryRateLimiter
from server.ai.tests.support import (
    FakeLlmProvider,
    FakeSttProvider,
    FakeVerifier,
    auth_headers,
    consult_body,
    test_settings,
)


class _SigningKey:
    key = "public-key"


class _KeyClient:
    def get_signing_key_from_jwt(self, token):
        self.token = token
        return _SigningKey()


class _JwtModule:
    class InvalidTokenError(Exception):
        pass

    def decode(self, token, key, **kwargs):
        self.arguments = {"token": token, "key": key, **kwargs}
        return {"sub": "verified-user"}


class AuthContractTests(unittest.TestCase):
    def test_verifier_requires_signature_issuer_audience_expiration_and_subject(self) -> None:
        verifier = SupabaseJwksVerifier.__new__(SupabaseJwksVerifier)
        verifier._jwt = _JwtModule()
        verifier._client = _KeyClient()
        verifier._signing_key = verifier._client.get_signing_key_from_jwt
        verifier._issuer = "https://example.supabase.co/auth/v1"
        verifier._audience = "authenticated"

        context = verifier._verify_sync("signed-token")

        self.assertEqual(context.user_id, "verified-user")
        args = verifier._jwt.arguments
        self.assertEqual(args["algorithms"], ["ES256", "RS256"])
        self.assertEqual(args["issuer"], verifier._issuer)
        self.assertEqual(args["audience"], "authenticated")
        self.assertEqual(set(args["options"]["require"]), {"exp", "iss", "aud", "sub"})

    def test_real_jwt_library_rejects_expiry_claim_mismatch_and_tampering(self) -> None:
        import jwt
        from cryptography.hazmat.primitives.asymmetric import rsa

        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public_key = private_key.public_key()

        verifier = SupabaseJwksVerifier(test_settings())
        jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(public_key))
        jwk.update(kid="test", use="sig", alg="RS256")
        # Exercise the real kid selection without network or production keys.
        verifier._client.fetch_data = lambda: {"keys": [jwk]}
        verifier._issuer = "https://example.supabase.co/auth/v1"
        verifier._audience = "authenticated"
        now = datetime.now(timezone.utc)

        def token(**overrides):
            claims = {
                "sub": "user-123",
                "iss": verifier._issuer,
                "aud": verifier._audience,
                "iat": now,
                "exp": now + timedelta(minutes=5),
            }
            claims.update(overrides)
            return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "test"})

        valid = token()
        self.assertEqual(verifier._verify_sync(valid).user_id, "user-123")
        parts = valid.split(".")
        tampered_payload = {
            "sub": "attacker",
            "iss": verifier._issuer,
            "aud": verifier._audience,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=5)).timestamp()),
        }
        parts[1] = base64.urlsafe_b64encode(
            json.dumps(tampered_payload, separators=(",", ":")).encode()
        ).rstrip(b"=").decode()
        invalid_tokens = (
            token(exp=now - timedelta(seconds=1)),
            token(iss="https://wrong.example/auth/v1"),
            token(aud="wrong"),
            token(sub=""),
            ".".join(parts),
        )
        for invalid in invalid_tokens:
            with self.assertRaises(jwt.PyJWTError):
                verifier._verify_sync(invalid)

        claims = jwt.decode(valid, options={"verify_signature": False})
        other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        missing_sub = {key: value for key, value in claims.items() if key != "sub"}
        additional_invalid = {
            "wrong_signature": jwt.encode(claims, other_key, algorithm="RS256", headers={"kid": "test"}),
            "missing_sub": jwt.encode(missing_sub, private_key, algorithm="RS256", headers={"kid": "test"}),
            "unknown_kid": jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "unknown"}),
            "unsupported_algorithm": jwt.encode(claims, "synthetic-test-key", algorithm="HS256", headers={"kid": "test"}),
            "unsigned": jwt.encode(claims, key=None, algorithm="none", headers={"kid": "test"}),
        }
        for name, invalid in additional_invalid.items():
            with self.subTest(name=name), self.assertRaises(jwt.PyJWTError):
                verifier._verify_sync(invalid)


class RateLimitTests(unittest.TestCase):
    def test_limiter_is_scoped_by_authenticated_user_and_operation(self) -> None:
        now = [100.0]
        limiter = InMemoryRateLimiter(clock=lambda: now[0])

        async def exercise():
            self.assertEqual(await limiter.allow("user-a:weekly", 1), (True, 0))
            self.assertFalse((await limiter.allow("user-a:weekly", 1))[0])
            self.assertTrue((await limiter.allow("user-a:consult", 1))[0])
            self.assertTrue((await limiter.allow("user-b:weekly", 1))[0])
            now[0] = 161.0
            self.assertTrue((await limiter.allow("user-a:weekly", 1))[0])

        import asyncio

        asyncio.run(exercise())

    def test_endpoint_returns_rate_limited(self) -> None:
        app = create_app(
            settings=test_settings(ai_requests_per_minute=1),
            verifier=FakeVerifier(),
            llm_provider=FakeLlmProvider(
                {"claim_type": "record_references", "fact_indexes": [0]},
                {"claim_type": "record_references", "fact_indexes": [0]},
            ),
            stt_provider=FakeSttProvider(),
        )
        client = TestClient(app, raise_server_exceptions=False)
        first = client.post("/v1/ai/execute", json=consult_body(), headers=auth_headers())
        second = client.post("/v1/ai/execute", json=consult_body(), headers=auth_headers())
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)
        self.assertEqual(second.json()["error"]["code"], "RATE_LIMITED")


if __name__ == "__main__":
    unittest.main()
