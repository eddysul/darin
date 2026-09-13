"""Transaction-only domain logic shared by Firestore and deterministic test stores."""
from __future__ import annotations

import asyncio
import hmac
from datetime import datetime, timedelta
from typing import Callable, Protocol, TypeVar

from ..errors import AppError
from ..telemetry import METRICS
from .identity import Fingerprints, digest, nonce_end
from .pricing import PROFILES
from .types import Accounting, Counter, CounterMarker, Minute, QuotaConfig, Reservation, Stage, TERMINAL, add, reject

T = TypeVar("T")


class Transaction(Protocol):
    now: datetime
    def get(self, path: str) -> dict | None: ...
    def set(self, path: str, value: dict) -> None: ...


class AtomicStore(Protocol):
    def run(self, name: str, action: Callable[[Transaction], T]) -> T: ...


class QuotaRepository(Protocol):
    async def configuration(self) -> QuotaConfig: ...
    async def reserve(self, user: str, operation: str, nonce: str | None, canonical: bytes,
                      stages: list[Stage], config_version: str, policy_version: str) -> tuple[Reservation, bool]: ...
    async def claim(self, rid: str, stage_id: str, owner: str, payload: str) -> bool: ...
    async def reconcile(self, rid: str, stage_id: str, owner: str, accounting: Accounting) -> None: ...
    async def mark_unknown(self, rid: str, stage_id: str, owner: str) -> None: ...
    async def cancel_unsent(self, rid: str, stage_id: str) -> None: ...
    async def recover(self, rid: str) -> None: ...


class UnavailableStore:
    def run(self, name, action):
        raise reject()


class CentralQuotaRepository:
    def __init__(self, store: AtomicStore, fingerprints: Fingerprints, environment: str, namespace: str):
        self.store = store
        self.fingerprints = fingerprints
        self.environment = environment
        self.namespace = namespace

    @staticmethod
    def _prefetch(tx, paths):
        # Optional adapter optimization only. No domain check or authoritative
        # read is skipped when the store does not support snapshot batching.
        prefetch = getattr(tx, "prefetch", None)
        if prefetch is not None:
            prefetch(paths)

    @classmethod
    def _prefetch_counters(cls, tx, paths, extra=()):
        cls._prefetch(tx, [*extra, *paths,
                          *("counterMarkers/" + digest(path) for path in paths)])

    async def _run(self, name, action):
        try:
            result = await asyncio.to_thread(self.store.run, name, action)
            if name == "reserve":
                METRICS.add("quota_accepted")
            else:
                METRICS.add(name + "_completed")
            return result
        except AppError as error:
            category = ("quota_idempotency" if error.code.startswith("IDEMPOTENCY_") else
                        "quota_cost_bound" if error.code == "COST_BOUND_UNAVAILABLE" else
                        "quota_limit" if error.status_code == 429 else "quota_integrity_or_config")
            METRICS.add(category)
            if name == "reserve":
                METRICS.add("quota_rejected")
            raise
        except Exception:
            if name == "reserve":
                METRICS.add("quota_rejected")
            # Do not propagate driver errors, documents, or credential details.
            raise reject() from None

    def _config(self, tx: Transaction) -> QuotaConfig:
        config = QuotaConfig.model_validate(tx.get("control/current"))
        if (config.environment != self.environment or config.identity_namespace != self.namespace
                or not config.enabled):
            raise reject()
        if (not config.profiles or len(set(config.profiles)) != len(config.profiles)
                or any(p not in PROFILES for p in config.profiles)):
            raise reject("COST_BOUND_UNAVAILABLE")
        self._time(tx)
        if (config.valid_from.tzinfo is None or config.valid_from.utcoffset() != timedelta(0)
                or config.valid_until.tzinfo is None or config.valid_until.utcoffset() != timedelta(0)
                or not config.valid_from <= tx.now < config.valid_until):
            raise reject("COST_BOUND_UNAVAILABLE")
        return config

    @staticmethod
    def _time(tx):
        if not isinstance(tx.now, datetime) or tx.now.tzinfo is None or tx.now.utcoffset() != timedelta(0):
            raise reject()

    async def configuration(self) -> QuotaConfig:
        return await self._run("config", self._config)

    @staticmethod
    def _counter_marker(path, counter):
        return CounterMarker(schema_version="counter-marker.v1", counter_id=digest(path),
            bootstrap_id=counter.bootstrap_id,
            state_digest=digest("counter-state-v1", path, counter.model_dump_json()))

    @classmethod
    def _counter(cls, tx, path, *, bootstrap=None):
        raw = tx.get(path)
        marker_raw = tx.get("counterMarkers/" + digest(path))
        if raw is None and marker_raw is None and bootstrap is not None:
            return bootstrap
        # A lone counter OR a lone marker is corruption, never first use. Neither
        # document has TTL. The marker also witnesses all accounting fields, so
        # even a well-typed partial reset cannot silently recreate money.
        if raw is None or marker_raw is None:
            raise reject()
        counter = Counter.model_validate(raw)
        marker = CounterMarker.model_validate(marker_raw)
        if marker != cls._counter_marker(path, counter):
            raise reject()
        return counter

    @classmethod
    def _write_counter(cls, tx, path, counter):
        tx.set(path, counter.model_dump())
        tx.set("counterMarkers/" + digest(path), cls._counter_marker(path, counter).model_dump())

    async def reserve(self, user, operation, nonce, canonical, stages, config_version, policy_version):
        end = nonce_end(nonce)
        subject = digest("subject-v1", self.namespace, user)
        rid = digest("reservation-v1", self.environment, subject, operation, nonce)

        def action(tx):
            self._prefetch(tx, ["control/current", f"reservations/{rid}",
                               *(f"blocks/{stage.profile_id}" for stage in stages)])
            config = self._config(tx)
            now = tx.now
            if now < end - timedelta(days=1):
                raise reject("IDEMPOTENCY_INVALID", 400)
            if now >= end + timedelta(days=7):
                raise reject("IDEMPOTENCY_EXPIRED", 410)
            existing = tx.get(f"reservations/{rid}")
            if existing is not None:
                old = Reservation.model_validate(existing)
                if old.id != rid or old.subject != subject or old.operation != operation:
                    raise reject()
                candidate = self.fingerprints.calculate(old.fingerprint_version, canonical)
                if not hmac.compare_digest(candidate, old.fingerprint):
                    raise reject("IDEMPOTENCY_CONFLICT", 409)
                return old, False
            if now >= end:
                raise reject("IDEMPOTENCY_EXPIRED", 410)
            if config.version != config_version:
                raise reject()
            if config.valid_until < now + timedelta(seconds=120):
                raise reject("COST_BOUND_UNAVAILABLE")
            expected_stages = ["stt", "parser"] if operation == "transcribe" else ["llm"]
            if [s.stage_id for s in stages] != expected_stages:
                raise reject("COST_BOUND_UNAVAILABLE")
            for stage in stages:
                profile = PROFILES.get(stage.profile_id)
                if (profile is None or stage.profile_id not in config.profiles
                        or stage.model != profile.model or stage.pricing_version != profile.version
                        or stage.reserved != profile.reserve(stage.output_cap, stage.duration_ms)
                        or stage.input_bound != profile.input_bound
                        or stage.state != "RESERVED" or stage.charged or stage.accounting is not None
                        or stage.observed_cost is not None or stage.dispatch_owner is not None
                        or stage.violation_accounting is not None
                        or tx.get(f"blocks/{stage.profile_id}") is not None):
                    raise reject("COST_BOUND_UNAVAILABLE")
            amount = add(*(s.reserved for s in stages))
            day = now.strftime("%Y%m%d")
            minute_path = "minute/" + digest(self.environment, subject, operation, now.strftime("%Y%m%d%H%M"))
            upath = "userDay/" + digest(self.environment, subject, day)
            gpath = "globalDay/" + digest(self.environment, day)
            self._prefetch_counters(tx, [gpath, upath], [minute_path])
            minute_raw = tx.get(minute_path)
            minute = Minute.model_validate(minute_raw) if minute_raw is not None else Minute(count=0)
            glob = self._counter(tx, gpath, bootstrap=Counter(schema_version="counter.v1",
                bootstrap_id=rid, held=0, charged=0, admissions=0,
                budget=config.global_budget, user_budget=config.user_budget))
            account = self._counter(tx, upath, bootstrap=Counter(schema_version="counter.v1",
                bootstrap_id=rid, held=0, charged=0, admissions=0,
                budget=glob.user_budget, user_budget=glob.user_budget))
            if minute.count >= config.minute_limit:
                raise reject("USER_QUOTA_EXCEEDED", 429)
            if add(account.charged, account.held, amount) > account.budget:
                raise reject("USER_QUOTA_EXCEEDED", 429)
            if add(glob.charged, glob.held, amount) > glob.budget:
                raise reject("GLOBAL_BUDGET_EXCEEDED", 429)
            record = Reservation(id=rid, subject=subject, operation=operation,
                fingerprint=self.fingerprints.calculate(config.fingerprint_version, canonical),
                fingerprint_version=config.fingerprint_version, config_version=config.version,
                policy_version=policy_version, admitted_at=now, day_end=end,
                dispatch_before=now + timedelta(seconds=120), user_bucket=upath, global_bucket=gpath,
                stages=[s.model_copy(deep=True) for s in stages])
            minute.count = add(minute.count, 1)
            for counter in (account, glob):
                counter.held = add(counter.held, amount)
                counter.admissions = add(counter.admissions, 1)
            # All reads precede these buffered writes, including on Firestore retries.
            tx.set(minute_path, minute.model_dump())
            self._write_counter(tx, upath, account)
            self._write_counter(tx, gpath, glob)
            tx.set(f"reservations/{rid}", record.model_dump())
            return record, True
        return await self._run("reserve", action)

    @staticmethod
    def _record(tx, rid):
        record = Reservation.model_validate(tx.get(f"reservations/{rid}"))
        if record.id != rid:
            raise reject()
        return record

    @staticmethod
    def _stage(record, stage_id):
        matches = [s for s in record.stages if s.stage_id == stage_id]
        if len(matches) != 1:
            raise reject()
        return matches[0]

    @staticmethod
    def _save(tx, record):
        if all(s.state in TERMINAL for s in record.stages):
            record.expires_at = record.day_end + timedelta(days=8)
        else:
            record.expires_at = None
        tx.set(f"reservations/{record.id}", record.model_dump())

    async def claim(self, rid, stage_id, owner, payload):
        def action(tx):
            self._prefetch(tx, ["control/current", f"reservations/{rid}"])
            config = self._config(tx)
            record = self._record(tx, rid)
            stage = self._stage(record, stage_id)
            self._prefetch_counters(tx, [record.user_bucket, record.global_bucket],
                                    [f"blocks/{stage.profile_id}"])
            blocked = tx.get(f"blocks/{stage.profile_id}")
            if stage.state != "RESERVED":
                return False
            if (tx.now >= record.dispatch_before or tx.now < record.admitted_at
                    or config.version != record.config_version or blocked is not None
                    or stage.profile_id not in config.profiles):
                raise reject()
            if stage_id == "parser":
                stt = self._stage(record, "stt")
                if stt.state not in {"SETTLED", "UNKNOWN"} or stt.accounting is None or stt.accounting.parse_status != "OK":
                    raise reject()
            if stage.payload_digest is not None and stage.payload_digest != payload:
                raise reject("COST_BOUND_UNAVAILABLE")
            # Recheck the durable money witness immediately before dispatch too.
            for path in (record.user_bucket, record.global_bucket):
                counter = self._counter(tx, path)
                if counter.held < stage.reserved:
                    raise reject()
            stage.payload_digest = payload
            stage.dispatch_owner = owner
            stage.state = "DISPATCHING"
            self._save(tx, record)
            return True
        return await self._run("claim", action)

    async def reconcile(self, rid, stage_id, owner, accounting):
        def action(tx):
            usage = accounting
            record = self._record(tx, rid)
            self._time(tx)
            stage = self._stage(record, stage_id)
            if (stage.state not in {"DISPATCHING", "UNKNOWN", "SETTLED", "SETTLED_CONSERVATIVE"}
                    or stage.dispatch_owner != owner):
                raise reject()
            if usage.stage_id != stage_id or usage.pricing_version != stage.pricing_version:
                raise reject()
            profile = PROFILES[stage.profile_id]
            if stage.model != profile.model or stage.pricing_version != profile.version:
                raise reject()
            try:
                actual = profile.actual(usage)
            except AppError:
                actual = None
                usage = usage.model_copy(update={"usage_status": "CONTRADICTORY", "failure_category": "USAGE_INVALID"})
            contradiction = usage.usage_status == "CONTRADICTORY"
            if stage.state in TERMINAL:
                # No refund/re-accounting of terminal money. Validate late
                # evidence before returning: a known overage must still freeze
                # the profile, even if recovery has already charged the full R.
                if usage.usage_status == "KNOWN" and actual is None:
                    raise reject()
                if actual is not None and actual > stage.reserved:
                    blocked = tx.get(f"blocks/{stage.profile_id}")
                    if stage.observed_cost is None or actual > stage.observed_cost:
                        stage.observed_cost = actual
                        stage.violation_accounting = usage
                        self._save(tx, record)
                    if blocked is None:
                        tx.set(f"blocks/{stage.profile_id}", {"blocked": True})
                    return True
                return False
            stage.accounting = usage
            if actual is None:
                stage.state = "UNKNOWN"
                if contradiction:
                    tx.set(f"blocks/{stage.profile_id}", {"blocked": True})
                self._save(tx, record)
                return contradiction
            self._prefetch_counters(tx, [record.user_bucket, record.global_bucket])
            account = self._counter(tx, record.user_bucket)
            glob = self._counter(tx, record.global_bucket)
            stage.observed_cost = actual
            try:
                totals = [add(counter.charged, actual) for counter in (account, glob)]
            except AppError:
                # Even an unrepresentable aggregate overage must retain observed
                # numeric evidence and freeze the profile, not lose the error.
                stage.state = "UNKNOWN"
                tx.set(f"blocks/{stage.profile_id}", {"blocked": True, "observed_cost": actual})
                self._save(tx, record)
                return True
            for counter, total in zip((account, glob), totals):
                if counter.held < stage.reserved:
                    raise reject()
                counter.held -= stage.reserved
                counter.charged = total
            stage.state = "SETTLED"
            stage.charged = actual
            violation = actual > stage.reserved or (
                profile.duration and usage.billable_duration_ms > stage.duration_ms
            ) or (not profile.duration and (
                usage.input_usage > stage.input_bound or usage.output_usage > stage.output_cap))
            if violation:
                # Preserve observed spend, even above the budget. Never clamp to R.
                tx.set(f"blocks/{stage.profile_id}", {"blocked": True, "observed_cost": actual})
            self._write_counter(tx, record.user_bucket, account)
            self._write_counter(tx, record.global_bucket, glob)
            self._save(tx, record)
            return violation
        violation = await self._run("reconcile", action)
        if violation:
            raise reject("ACCOUNTING_INVARIANT_VIOLATION", 503)

    async def mark_unknown(self, rid, stage_id, owner):
        def action(tx):
            record = self._record(tx, rid)
            stage = self._stage(record, stage_id)
            if stage.state == "DISPATCHING" and stage.dispatch_owner == owner:
                stage.state = "UNKNOWN"
                self._save(tx, record)
        await self._run("unknown", action)

    async def cancel_unsent(self, rid, stage_id):
        await self._finish(rid, stage_id, recovery=False)

    async def recover(self, rid):
        await self._finish(rid, None, recovery=True)

    async def _finish(self, rid, stage_id, recovery):
        def action(tx):
            record = self._record(tx, rid)
            self._time(tx)
            self._prefetch_counters(tx, [record.user_bucket, record.global_bucket])
            account = self._counter(tx, record.user_bucket)
            glob = self._counter(tx, record.global_bucket)
            for stage in record.stages:
                if stage_id is not None and stage.stage_id != stage_id:
                    continue
                release = stage.state == "RESERVED" and (not recovery or tx.now >= record.dispatch_before)
                conservative = recovery and stage.state in {"DISPATCHING", "UNKNOWN"} and tx.now >= record.admitted_at + timedelta(minutes=5)
                if not release and not conservative:
                    continue
                for counter in (account, glob):
                    if counter.held < stage.reserved:
                        raise reject()
                    counter.held -= stage.reserved
                    if conservative:
                        counter.charged = add(counter.charged, stage.reserved)
                stage.state = "SETTLED_CONSERVATIVE" if conservative else "CANCELLED_UNSENT"
                stage.charged = stage.reserved if conservative else 0
            self._write_counter(tx, record.user_bucket, account)
            self._write_counter(tx, record.global_bucket, glob)
            self._save(tx, record)
        await self._run("recover" if recovery else "cancel", action)
