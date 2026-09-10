from __future__ import annotations

import asyncio
from dataclasses import replace
from datetime import timedelta
import multiprocessing
import unittest
from unittest.mock import patch


from server.ai.app.errors import AppError
from server.ai.app.quota.identity import digest
from server.ai.app.quota.pricing import LLM, PROFILES, make_stage
from server.ai.app.quota.types import Accounting, MAX_INT, add, cost
from server.ai.tests.quota_fake import KEYS, NOW, SharedState, config, service


def nonce(n=0, day="20260909"):
    return f"{day}.{n:032x}"


def stage():
    return make_stage("llm", LLM.model, 220, digest("payload"))


async def reserve(s, n=0, user="u", payload=b"input", key=None, stages=None, version="c1"):
    return await s.repository.reserve(user, "weekly_narrative", key or nonce(n), payload,
        stages or [stage()], version, "policy.v1")


def accounting(**changes):
    return Accounting(stage_id="llm", pricing_version=LLM.version, observed_model=LLM.model,
        usage_status="KNOWN", input_usage=100, output_usage=10, parse_status="OK", **changes)


def process_requests(data, lock, output, offset, duplicate):
    """Independent process/client/repository; only the backing central state is shared."""
    async def execute():
        s = service(SharedState(data, lock))
        async def one(i):
            try:
                record, new = await reserve(s, 0 if duplicate else offset + i)
                if duplicate and new:
                    winner = await s.repository.claim(record.id, "llm", digest("owner", str(offset)), digest("payload"))
                    if winner:
                        # Fake provider billing occurs outside the transaction.
                        with lock:
                            data["test_provider_calls"] = data.get("test_provider_calls", 0) + 1
                return int(new)
            except AppError:
                return 0
        output.put(sum(await asyncio.gather(*(one(i) for i in range(50)))))
    asyncio.run(execute())


class MonetaryTests(unittest.TestCase):
    def test_rounding_does_not_truncate_fractional_token_price(self):
        self.assertEqual(cost(1, 150_000, 1_000_000), 1)
        self.assertEqual(cost(10, 150_000, 1_000_000), 2)
        self.assertEqual(cost(100, 150_000, 1_000_000), 15)

    def test_invalid_money_and_overflow_fail_closed(self):
        for args in [(-1, 1, 1), (True, 1, 1), (1.0, 1, 1), (1, -1, 1),
                     (1, 1, 0), (MAX_INT, 2, 1), (1, MAX_INT + 1, 1)]:
            with self.subTest(args=args), self.assertRaises(AppError): cost(*args)
        with self.assertRaises(AppError): add(MAX_INT, 1)

    def test_entire_context_reserved_and_invalid_profiles_rejected(self):
        s = stage()
        self.assertEqual(s.reserved, 19_332)
        self.assertEqual(s.input_bound, 128_000)
        with self.assertRaises(AppError): make_stage("llm", "arbitrary-model", 220, None)
        with self.assertRaises(AppError): make_stage("llm", LLM.model, 20_000, None)
        with self.assertRaises(AppError): replace(LLM, input_price=-1).reserve(220)
        with self.assertRaises(AppError): replace(LLM, input_price=0).reserve(220)
        with self.assertRaises(AppError): replace(LLM, input_price=MAX_INT).reserve(220)


class LedgerTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.state = SharedState()
        self.s = service(self.state)
        self.repo = self.s.repository

    def records(self):
        return [v for k, v in self.state.data.items() if k.startswith("reservations/")]

    def counters(self, prefix="globalDay/"):
        return [v for k, v in self.state.data.items() if k.startswith(prefix)]

    def invariant(self):
        for counter in self.counters() + self.counters("userDay/"):
            self.assertLessEqual(counter["held"] + counter["charged"], counter["budget"])

    async def test_same_user_100_concurrent_two_clients_last_and_first_over_limit(self):
        self.state.data["control/current"] = config(minute_limit=37)
        clients = [self.s, service(self.state)]
        async def one(i):
            try: return (await reserve(clients[i % 2], i))[1]
            except AppError as e:
                self.assertEqual(e.code, "USER_QUOTA_EXCEEDED")
                return False
        self.assertEqual(sum(await asyncio.gather(*(one(i) for i in range(100)))), 37)
        self.assertEqual(self.counters()[0]["admissions"], 37)
        self.invariant()

    async def test_different_users_100_concurrent_global_budget_boundary(self):
        self.state.data["control/current"] = config(global_budget=stage().reserved * 23)
        clients = [self.s, service(self.state)]
        results = await asyncio.gather(*(reserve(clients[i % 2], i, user=f"u{i}") for i in range(100)), return_exceptions=True)
        self.assertEqual(sum(not isinstance(r, Exception) for r in results), 23)
        self.assertEqual(self.counters()[0]["held"], stage().reserved * 23)
        self.invariant()

    async def test_user_daily_budget_remains_after_local_limiter_restart(self):
        self.state.data["control/current"] = config(user_budget=stage().reserved)
        await reserve(self.s)
        replacement = service(self.state)
        with self.assertRaises(AppError) as e: await reserve(replacement, 1)
        self.assertEqual(e.exception.code, "USER_QUOTA_EXCEEDED")
        self.invariant()

    async def test_same_key_concurrency_creates_one_reservation(self):
        clients = [self.s, service(self.state)]
        results = await asyncio.gather(*(reserve(clients[i % 2]) for i in range(100)))
        self.assertEqual(sum(new for _, new in results), 1)
        self.assertEqual(len(self.records()), 1)
        self.assertEqual(self.counters()[0]["admissions"], 1)

    async def test_stage_claim_100_contenders_single_winner_no_takeover(self):
        r, _ = await reserve(self.s)
        clients = [self.repo, service(self.state).repository]
        results = await asyncio.gather(*(clients[i % 2].claim(r.id, "llm", digest(str(i)), digest("payload")) for i in range(100)))
        self.assertEqual(sum(results), 1)
        self.state.now += timedelta(minutes=6)
        self.assertFalse(await self.repo.claim(r.id, "llm", digest("late"), digest("payload")))

    async def test_crash_after_reservation_can_cancel_unsent_exactly_once(self):
        r, _ = await reserve(self.s)
        await self.repo.cancel_unsent(r.id, "llm")
        await self.repo.cancel_unsent(r.id, "llm")
        self.assertEqual(self.counters()[0]["held"], 0)
        self.assertEqual(self.counters()[0]["admissions"], 1)
        self.assertFalse(await self.repo.claim(r.id, "llm", digest("x"), digest("payload")))

    async def test_crash_after_dispatch_never_refunds(self):
        r, _ = await reserve(self.s)
        await self.repo.claim(r.id, "llm", digest("owner"), digest("payload"))
        await self.repo.cancel_unsent(r.id, "llm")
        self.assertEqual(self.counters()[0]["held"], stage().reserved)
        self.assertIsNone(self.records()[0]["expires_at"])

    async def test_provider_billed_crash_recovery_charges_full_reservation(self):
        r, _ = await reserve(self.s)
        await self.repo.claim(r.id, "llm", digest("owner"), digest("payload"))
        billed = 21  # Independent fake-provider spend, no reconcile after crash.
        self.assertGreaterEqual(self.counters()[0]["held"], billed)
        self.state.now += timedelta(minutes=5)
        await service(self.state).repository.recover(r.id)
        self.assertEqual(self.counters()[0]["held"], 0)
        self.assertEqual(self.counters()[0]["charged"], stage().reserved)
        self.assertEqual(self.records()[0]["stages"][0]["state"], "SETTLED_CONSERVATIVE")
        await self.repo.reconcile(r.id, "llm", digest("owner"), accounting())
        self.assertEqual(self.counters()[0]["charged"], stage().reserved)

    async def test_known_usage_duplicate_reconcile_is_noop(self):
        r, _ = await reserve(self.s)
        await self.repo.claim(r.id, "llm", digest("owner"), digest("payload"))
        await asyncio.gather(*(self.repo.reconcile(r.id, "llm", digest("owner"), accounting()) for _ in range(100)))
        self.assertEqual(self.counters()[0]["held"], 0)
        self.assertEqual(self.counters()[0]["charged"], 21)
        self.invariant()

    async def test_unknown_usage_holds_full_amount(self):
        r, _ = await reserve(self.s)
        await self.repo.claim(r.id, "llm", digest("owner"), digest("payload"))
        await self.repo.reconcile(r.id, "llm", digest("owner"), Accounting(stage_id="llm", pricing_version=LLM.version))
        self.assertEqual(self.counters()[0]["held"], stage().reserved)
        self.assertEqual(self.records()[0]["stages"][0]["state"], "UNKNOWN")

    async def test_actual_above_reserved_is_recorded_not_clamped_and_blocks_profile(self):
        self.state.data["control/current"] = config(global_budget=stage().reserved)
        r, _ = await reserve(self.s)
        await self.repo.claim(r.id, "llm", digest("owner"), digest("payload"))
        usage = accounting().model_copy(update={"input_usage": 256_000})
        with self.assertRaises(AppError) as e:
            await self.repo.reconcile(r.id, "llm", digest("owner"), usage)
        self.assertEqual(e.exception.code, "ACCOUNTING_INVARIANT_VIOLATION")
        self.assertEqual(self.counters()[0]["charged"], 38_406)
        self.assertEqual(self.records()[0]["stages"][0]["charged"], 38_406)
        self.assertGreater(self.counters()[0]["charged"], self.counters()[0]["budget"])
        with self.assertRaises(AppError): await reserve(service(self.state), 1)

    async def test_accounting_overflow_keeps_evidence_and_blocks_without_refund(self):
        r, _ = await reserve(self.s)
        await self.repo.claim(r.id, "llm", digest("owner"), digest("payload"))
        with self.assertRaises(AppError):
            await self.repo.reconcile(r.id, "llm", digest("owner"), accounting().model_copy(update={"input_usage": MAX_INT}))
        self.assertEqual(self.records()[0]["stages"][0]["accounting"]["input_usage"], MAX_INT)
        self.assertEqual(self.counters()[0]["held"], stage().reserved)
        with self.assertRaises(AppError): await reserve(self.s, 1)

    async def test_wrong_owner_cannot_settle(self):
        r, _ = await reserve(self.s)
        await self.repo.claim(r.id, "llm", digest("owner"), digest("payload"))
        with self.assertRaises(AppError): await self.repo.reconcile(r.id, "llm", digest("other"), accounting())
        self.assertEqual(self.counters()[0]["held"], stage().reserved)

    async def test_datastore_and_reconcile_outage_keep_funds(self):
        self.repo.store.fail_before.add("reserve")
        with self.assertRaises(AppError): await reserve(self.s)
        self.assertEqual(self.records(), [])
        self.repo.store.fail_before.clear()
        r, _ = await reserve(self.s)
        await self.repo.claim(r.id, "llm", digest("owner"), digest("payload"))
        self.repo.store.fail_before.add("reconcile")
        with self.assertRaises(AppError): await self.repo.reconcile(r.id, "llm", digest("owner"), accounting())
        self.assertEqual(self.counters()[0]["held"], stage().reserved)

    async def test_reservation_commit_response_loss_does_not_reserve_twice(self):
        self.repo.store.lose_response.add("reserve")
        with self.assertRaises(AppError): await reserve(self.s)
        r, new = await reserve(self.s)
        self.assertFalse(new)
        self.assertEqual(self.counters()[0]["admissions"], 1)

    async def test_dispatch_commit_response_loss_never_reacquires(self):
        r, _ = await reserve(self.s)
        self.repo.store.lose_response.add("claim")
        with self.assertRaises(AppError): await self.repo.claim(r.id, "llm", digest("owner"), digest("payload"))
        self.assertFalse(await service(self.state).repository.claim(r.id, "llm", digest("other"), digest("payload")))
        self.assertEqual(self.counters()[0]["held"], stage().reserved)

    async def test_same_key_different_input_rejected(self):
        await reserve(self.s)
        with self.assertRaises(AppError) as e: await reserve(self.s, payload=b"changed")
        self.assertEqual(e.exception.code, "IDEMPOTENCY_CONFLICT")
        self.assertEqual(len(self.records()), 1)

    async def test_different_accounts_do_not_share_idempotency(self):
        a, _ = await reserve(self.s, user="a")
        b, _ = await reserve(self.s, user="b")
        self.assertNotEqual(a.id, b.id)
        self.assertNotEqual(a.subject, b.subject)

    async def test_expired_keys_cannot_be_recreated_after_ttl(self):
        r, _ = await reserve(self.s)
        self.state.now = r.day_end + timedelta(days=7)
        with self.assertRaises(AppError) as e: await reserve(self.s)
        self.assertEqual(e.exception.code, "IDEMPOTENCY_EXPIRED")
        del self.state.data[f"reservations/{r.id}"]  # Simulated terminal TTL deletion.
        with self.assertRaises(AppError): await reserve(self.s)

    async def test_yesterday_missing_and_future_nonce_rejected(self):
        for day in ("20260908", "20260910", "20269999"):
            with self.subTest(day=day), self.assertRaises(AppError): await reserve(self.s, key=nonce(day=day))
        self.assertEqual(self.records(), [])

    async def test_nonce_validation(self):
        for key in ["bad", "20260909.a", "20260909." + "a" * 1000, "20260909." + "G" * 32, nonce(day="99991231")]:
            with self.subTest(key=key[:20]), self.assertRaises(AppError): await reserve(self.s, key=key)

    async def test_midnight_retry_lookup_and_reconcile_original_day(self):
        self.state.now = NOW.replace(hour=23, minute=59, second=59)
        r, _ = await reserve(self.s)
        await self.repo.claim(r.id, "llm", digest("owner"), digest("payload"))
        self.state.now += timedelta(seconds=2)
        duplicate, new = await reserve(self.s)
        self.assertFalse(new)
        self.assertEqual(duplicate.id, r.id)
        await self.repo.reconcile(r.id, "llm", digest("owner"), accounting())
        tomorrow, _ = await reserve(self.s, key=nonce(day="20260910"))
        self.assertNotEqual(tomorrow.global_bucket, r.global_bucket)
        self.assertEqual(self.state.data[r.global_bucket]["charged"], 21)

    async def test_minute_boundary_uses_store_clock(self):
        self.state.data["control/current"] = config(minute_limit=1)
        await reserve(self.s)
        with self.assertRaises(AppError): await reserve(self.s, 1)
        self.state.now += timedelta(minutes=1)
        await reserve(self.s, 1)
        self.assertEqual(self.counters()[0]["admissions"], 2)

    async def test_transaction_retry_uses_successful_attempt_time(self):
        self.repo.store.retry_count = 1
        self.repo.store.on_retry = lambda: setattr(self.state, "now", self.state.now + timedelta(minutes=1))
        r, _ = await reserve(self.s)
        self.assertEqual(r.admitted_at, NOW + timedelta(minutes=1))
        self.assertEqual(self.counters()[0]["admissions"], 1)
        self.repo.store.retry_count = 3
        with self.assertRaises(AppError): await reserve(self.s, 1)

    async def test_transaction_retry_crossing_midnight_does_not_admit_old_nonce(self):
        self.state.now = NOW.replace(hour=23, minute=59, second=59)
        self.repo.store.retry_count = 1
        self.repo.store.on_retry = lambda: setattr(self.state, "now", self.state.now + timedelta(seconds=2))
        with self.assertRaises(AppError): await reserve(self.s)
        self.assertEqual(self.records(), [])

    async def test_config_version_change_cannot_reset_daily_budget(self):
        self.state.data["control/current"] = config(user_budget=stage().reserved)
        await reserve(self.s)
        self.state.data["control/current"] = config(version="c2", user_budget=100_000_000)
        with self.assertRaises(AppError): await reserve(self.s, 1, version="c2")
        self.assertEqual(self.counters()[0]["user_budget"], stage().reserved)
        self.assertEqual(len(self.counters()), 1)
        await reserve(self.s, 2, user="new-user", version="c2")
        with self.assertRaises(AppError): await reserve(self.s, 3, user="new-user", version="c2")

    async def test_reviewed_pricing_version_change_shares_existing_money_ledger(self):
        self.state.data["control/current"] = config(user_budget=stage().reserved * 3,
                                                    global_budget=stage().reserved * 3)
        original, _ = await reserve(self.s)
        reviewed = replace(LLM, id="reviewed-price-v2", version="price.v2",
                           input_price=LLM.input_price * 2, output_price=LLM.output_price * 2)
        next_stage = stage().model_copy(update={"profile_id": reviewed.id,
            "pricing_version": reviewed.version, "reserved": reviewed.reserve(220)})
        with patch.dict(PROFILES, {reviewed.id: reviewed}):
            self.state.data["control/current"]["version"] = "c2"
            self.state.data["control/current"]["profiles"].append(reviewed.id)
            existing, new = await reserve(self.s, stages=[next_stage], version="c2")
            self.assertFalse(new)
            self.assertEqual(existing.id, original.id)
            second, _ = await reserve(self.s, 1, stages=[next_stage], version="c2")
            self.assertEqual(second.global_bucket, original.global_bucket)
            self.assertEqual(second.user_bucket, original.user_bucket)
            self.assertEqual(second.stages[0].pricing_version, "price.v2")
            with self.assertRaises(AppError): await reserve(self.s, 2, stages=[next_stage], version="c2")
        self.assertEqual(self.counters()[0]["held"], stage().reserved * 3)
        self.assertEqual(self.counters()[0]["admissions"], 2)

    async def test_changed_config_blocks_existing_undispatched_plan(self):
        r, _ = await reserve(self.s)
        self.state.data["control/current"]["version"] = "c2"
        with self.assertRaises(AppError): await self.repo.claim(r.id, "llm", digest("x"), digest("payload"))

    async def test_unsupported_or_underreserved_pricing_is_rejected(self):
        for change in [{"reserved": 1}, {"pricing_version": "unknown"}, {"input_bound": 100}]:
            with self.subTest(change=change), self.assertRaises(AppError):
                await reserve(self.s, stages=[stage().model_copy(update=change)])
        self.assertEqual(self.records(), [])

    async def test_missing_corrupt_disabled_overflow_config_fails_closed(self):
        for invalid in [None, {}, config(enabled=False), config(contract="unknown"),
                        config(user_budget=-1), config(global_budget=MAX_INT + 1),
                        config(minute_limit=True), config(environment="other"),
                        config(profiles=["unknown"]), config(version="has spaces")]:
            self.state.data["control/current"] = invalid
            with self.subTest(invalid=str(invalid)[:20]), self.assertRaises(AppError): await reserve(self.s)
        self.assertEqual(self.records(), [])

    async def test_hmac_rotation_preserves_lookup_and_user_budget(self):
        r, _ = await reserve(self.s)
        self.state.data["control/current"]["fingerprint_version"] = "k2"
        replacement = service(self.state)
        duplicate, new = await reserve(replacement)
        self.assertFalse(new)
        self.assertEqual(duplicate.id, r.id)
        second, _ = await reserve(replacement, 1)
        self.assertEqual(second.user_bucket, r.user_bucket)
        self.assertEqual(second.fingerprint_version, "k2")
        with self.assertRaises(AppError): await reserve(replacement, payload=b"changed")
        missing_old = service(self.state, keys={"k2": KEYS["k2"]})
        with self.assertRaises(AppError): await reserve(missing_old)
        self.assertEqual(len(self.records()), 2)

    async def test_recovery_never_reopens_dispatch_or_resets_minute_count(self):
        r, _ = await reserve(self.s)
        self.state.now += timedelta(seconds=121)
        await self.repo.recover(r.id)
        self.assertEqual(self.records()[0]["stages"][0]["state"], "CANCELLED_UNSENT")
        self.assertIsNotNone(self.records()[0]["expires_at"])
        self.assertEqual(self.counters()[0]["admissions"], 1)
        self.assertFalse((await reserve(self.s))[1])

    async def test_corrupt_existing_minute_does_not_reset_to_zero(self):
        await reserve(self.s)
        path = next(k for k in self.state.data if k.startswith("minute/"))
        self.state.data[path] = {}
        with self.assertRaises(AppError): await reserve(self.s, 1)
        self.assertEqual(len(self.records()), 1)

    async def test_missing_old_counter_never_recreated_during_reconcile(self):
        r, _ = await reserve(self.s)
        await self.repo.claim(r.id, "llm", digest("owner"), digest("payload"))
        del self.state.data[r.user_bucket]
        with self.assertRaises(AppError): await self.repo.reconcile(r.id, "llm", digest("owner"), accounting())
        self.assertNotIn(r.user_bucket, self.state.data)
        self.assertEqual(self.counters()[0]["held"], stage().reserved)

    async def test_expired_central_pricing_approval_fails_closed(self):
        self.state.data["control/current"]["valid_until"] = NOW + timedelta(seconds=119)
        with self.assertRaises(AppError): await reserve(self.s)
        self.assertEqual(self.records(), [])

    async def test_aggregate_overflow_keeps_observed_cost_and_freezes_profile(self):
        self.state.data["control/current"] = config(global_budget=MAX_INT)
        r, _ = await reserve(self.s)
        # Seed a valid, witnessed near-limit aggregate (not a corrupt counter).
        def seed(tx):
            counter = self.repo._counter(tx, r.global_bucket)
            counter.charged = MAX_INT - stage().reserved
            self.repo._write_counter(tx, r.global_bucket, counter)
        await self.repo._run("test-seed", seed)
        await self.repo.claim(r.id, "llm", digest("owner"), digest("payload"))
        with self.assertRaises(AppError) as e:
            await self.repo.reconcile(r.id, "llm", digest("owner"), accounting().model_copy(update={"input_usage": 256_000}))
        self.assertEqual(e.exception.code, "ACCOUNTING_INVARIANT_VIOLATION")
        self.assertEqual(self.records()[0]["stages"][0]["observed_cost"], 38_406)
        self.assertEqual(self.counters()[0]["held"], stage().reserved)
        with self.assertRaises(AppError): await reserve(self.s, 1)


class ProcessConcurrencyTests(unittest.TestCase):
    def run_processes(self, duplicate):
        context = multiprocessing.get_context("spawn")
        with context.Manager() as manager:
            data = manager.dict({"control/current": config(global_budget=stage().reserved * 37)})
            lock = manager.RLock()
            output = manager.Queue()
            workers = [context.Process(target=process_requests, args=(data, lock, output, i * 50, duplicate)) for i in range(2)]
            for worker in workers: worker.start()
            for worker in workers:
                worker.join(30)
                if worker.is_alive():
                    worker.terminate()
                    worker.join()
                    self.fail("process concurrency test exceeded deadline")
                self.assertEqual(worker.exitcode, 0)
            admitted = sum(output.get(timeout=3) for _ in workers)
            counter = next(v for k, v in data.items() if k.startswith("globalDay/"))
            self.assertLessEqual(counter["held"] + counter["charged"], counter["budget"])
            self.assertEqual(admitted, 1 if duplicate else 37)
            self.assertEqual(data.get("test_provider_calls", 0), 1 if duplicate else 0)

    def test_100_requests_two_independent_processes_global_ceiling(self):
        self.run_processes(False)

    def test_100_duplicate_requests_two_processes_single_provider_dispatch(self):
        self.run_processes(True)
