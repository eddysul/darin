"""Offline P1 abuse regressions; no credentials or provider calls."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
import time
import unittest

import jwt
from cryptography.hazmat.primitives.asymmetric import ec, rsa

from server.ai.app.auth import SupabaseJwksVerifier
from server.ai.app.rate_limit import InMemoryRateLimiter
from server.ai.tests.support import test_settings
from server.ai.tests import test_voice_grounding as harness


class JwksHardeningTests(unittest.TestCase):
    def setUp(self):
        self.now = [100.0]
        self.verifier = SupabaseJwksVerifier(test_settings(), clock=lambda: self.now[0])
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
        jwk.update(kid="current", use="sig", alg="RS256")
        self.jwk = jwk
        self.keys = [jwk]
        self.fetches = 0

        def fetch():
            self.fetches += 1
            return {"keys": self.keys}

        self.verifier._client.fetch_data = fetch

    def token(self, kid="current", alg="RS256"):
        # Header selection only; actual signature verification is separately
        # exercised by AuthContractTests with real signed JWTs.
        import base64
        header = base64.urlsafe_b64encode(json.dumps({"alg":alg,"kid":kid}).encode()).rstrip(b"=").decode()
        return header + ".e30.c2ln"

    def test_unknown_kid_concurrent_flood_has_single_refresh(self):
        def rejected(i):
            with self.assertRaises(jwt.InvalidTokenError):
                self.verifier._signing_key(self.token(f"unknown-{i}"))
        with ThreadPoolExecutor(max_workers=12) as pool:
            list(pool.map(rejected, range(100)))
        self.assertEqual(self.fetches, 1)
        self.verifier._signing_key(self.token())
        self.assertEqual(self.fetches, 1)

    def test_removed_key_expires_and_rotation_refresh_is_bounded(self):
        self.verifier._signing_key(self.token())
        self.keys = [{**self.jwk, "kid":"rotated"}]
        self.now[0] += 301
        with self.assertRaises(jwt.InvalidTokenError):
            self.verifier._signing_key(self.token())
        self.verifier._signing_key(self.token("rotated"))
        self.assertEqual(self.fetches, 2)

    def test_outage_fails_closed_and_does_not_refetch_each_token(self):
        self.verifier._signing_key(self.token())
        self.now[0] += 301
        def fail():
            self.fetches += 1
            raise jwt.PyJWKClientError("offline")
        self.verifier._client.fetch_data = fail
        for _ in range(10):
            with self.assertRaises(jwt.PyJWTError):
                self.verifier._signing_key(self.token())
        self.assertEqual(self.fetches, 2)

    def test_new_key_available_after_cooldown_and_outage_can_recover(self):
        self.verifier._signing_key(self.token())
        self.keys = [{**self.jwk, "kid":"rotated"}]
        with self.assertRaises(jwt.InvalidTokenError):
            self.verifier._signing_key(self.token("rotated"))
        self.now[0] += 30
        self.verifier._signing_key(self.token("rotated"))
        with self.assertRaises(jwt.InvalidTokenError):
            self.verifier._signing_key(self.token())
        self.assertEqual(self.fetches, 2)
        self.now[0] += 301
        self.keys = []
        with self.assertRaises(jwt.PyJWTError):
            self.verifier._signing_key(self.token("rotated"))
        self.keys = [{**self.jwk, "kid":"rotated"}]
        self.now[0] += 30
        self.verifier._signing_key(self.token("rotated"))
        self.assertEqual(self.fetches, 4)

    def test_invalid_algorithm_and_kid_never_fetch(self):
        for kid,alg in [("current","HS256"),("current","none"),(None,"RS256"),("x"*257,"RS256")]:
            with self.assertRaises(jwt.InvalidTokenError):
                self.verifier._signing_key(self.token(kid,alg))
        self.assertEqual(self.fetches, 0)

    def test_real_es256_access_token_still_verifies(self):
        private = ec.generate_private_key(ec.SECP256R1())
        jwk = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private.public_key()))
        self.keys = [{**jwk, "kid":"ec-current", "use":"sig", "alg":"ES256"}]
        token = jwt.encode({"sub":"synthetic-user", "iss":self.verifier._issuer,
                            "aud":self.verifier._audience, "exp":int(time.time())+60},
                           private, algorithm="ES256", headers={"kid":"ec-current"})
        self.assertEqual(asyncio.run(self.verifier.verify(token)).user_id, "synthetic-user")
        self.assertEqual(self.fetches, 1)


class LimiterHardeningTests(unittest.TestCase):
    def test_capacity_does_not_evict_active_quota_and_expired_users_recover(self):
        now = [100.0]
        limiter = InMemoryRateLimiter(clock=lambda:now[0], max_keys=2)
        async def exercise():
            self.assertTrue((await limiter.allow("a",1))[0])
            self.assertTrue((await limiter.allow("b",1))[0])
            self.assertFalse((await limiter.allow("c",1))[0])
            self.assertFalse((await limiter.allow("a",1))[0])
            now[0] += 60
            self.assertTrue((await limiter.allow("c",1))[0])
            self.assertEqual(set(limiter._events), {"c"})
        asyncio.run(exercise())

    def test_concurrent_requests_and_retry_after_round_up(self):
        now = [100.0]
        limiter = InMemoryRateLimiter(clock=lambda:now[0])
        async def exercise():
            results = await asyncio.gather(*(limiter.allow("a",3) for _ in range(100)))
            self.assertEqual(sum(allowed for allowed,_ in results),3)
            now[0] += 0.2
            self.assertEqual(await limiter.allow("a",3), (False,60))
        asyncio.run(exercise())


class VoiceQuantityHardeningTests(unittest.TestCase):
    route = harness.VoiceGroundingTests.route

    def test_partial_source_cannot_strip_numeric_qualifiers(self):
        for text in ["formula -120ml", "formula −120ml", "formula 100-120ml",
                     "formula 100 to 120ml", "formula about 120ml", "formula 1e120ml",
                     "formula 1,120ml", "분유 120ml 정도", "ミルク 約120ml",
                     "奶 大约120ml", "leche aproximadamente 120ml"]:
            with self.subTest(text=text):
                self.route(text,[{"category":"식사","amount":120}],422,"NUMBER_UNIT_NOT_GROUNDED")
        self.route("formula -120ml", [{"category":"식사","amount":120,"source_text":"120ml"}],422,"NUMBER_UNIT_NOT_GROUNDED")

    def test_exact_decimal_remains_supported(self):
        self.route("formula 120.5ml", [{"category":"식사","amount":120.5}],200)
