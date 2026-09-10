from __future__ import annotations

import asyncio
import threading
import time
from dataclasses import dataclass
from typing import Annotated, Protocol

from fastapi import Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings
from .errors import AppError


_BEARER = HTTPBearer(auto_error=False)


@dataclass(frozen=True, slots=True)
class AuthContext:
    user_id: str


class TokenVerifier(Protocol):
    async def verify(self, token: str) -> AuthContext: ...


class SupabaseJwksVerifier:
    """Verify Supabase access tokens locally against the project's JWKS."""

    def __init__(self, settings: Settings, *, clock=time.monotonic) -> None:
        # Kept inside the constructor so tests can inject a verifier without
        # requiring production authentication dependencies or network access.
        import jwt

        self._jwt = jwt
        self._client = jwt.PyJWKClient(
            settings.supabase_jwks_url,
            cache_keys=False,
            lifespan=300,
            timeout=5,
        )
        self._issuer = settings.supabase_jwt_issuer
        self._audience = settings.supabase_jwt_audience
        self._clock = clock
        self._keys = []
        self._expires = 0.0
        self._next_refresh = 0.0
        self._refresh_lock = threading.Lock()

    def _signing_key(self, token: str):
        header = self._jwt.get_unverified_header(token)
        kid = header.get("kid")
        if header.get("alg") not in {"ES256", "RS256"} or not isinstance(kid, str) or not 0 < len(kid) <= 256:
            raise self._jwt.InvalidTokenError("invalid signing header")
        # One shared cooldown, not an attacker-controlled per-kid cache. Never
        # retain individual keys beyond the current JWKS snapshot's lifetime.
        with self._refresh_lock:
            now = self._clock()
            keys = self._keys if now < self._expires else []
            matches = [key for key in keys if key.key_id == kid]
            if not matches and now >= self._next_refresh:
                self._next_refresh = now + 30
                self._keys = []
                self._expires = 0
                self._keys = self._client.get_signing_keys(refresh=True)
                self._expires = self._clock() + 300
                matches = [key for key in self._keys if key.key_id == kid]
            if len(matches) != 1:
                raise self._jwt.InvalidTokenError("unknown signing key")
            return matches[0]

    def _verify_sync(self, token: str) -> AuthContext:
        signing_key = self._signing_key(token)
        claims = self._jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience=self._audience,
            issuer=self._issuer,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
        user_id = claims.get("sub")
        if not isinstance(user_id, str) or not user_id.strip():
            raise self._jwt.InvalidTokenError("missing subject")
        return AuthContext(user_id=user_id)

    async def verify(self, token: str) -> AuthContext:
        if not token or len(token) > 8_192:
            raise ValueError("invalid token")
        return await asyncio.to_thread(self._verify_sync, token)


class RequireAuth:
    def __init__(self, verifier: TokenVerifier) -> None:
        self._verifier = verifier

    async def __call__(
        self,
        request: Request,
        credentials: Annotated[HTTPAuthorizationCredentials | None, Security(_BEARER)],
    ) -> AuthContext:
        if credentials is None or credentials.scheme.lower() != "bearer":
            raise AppError("AUTH_REQUIRED", 401, "A valid bearer token is required.")
        try:
            context = await self._verifier.verify(credentials.credentials)
        except Exception as exc:
            raise AppError("AUTH_INVALID", 401, "The bearer token is invalid or expired.") from exc
        request.state.user_id = context.user_id
        return context
