"""Opt-in administrative ledger exercise. NO provider adapters or HTTP routes.

Runs only in a synthetic-* database/environment, under a unique syntheticRuns
prefix. The base control/current must be provisioned by an operator beforehand.
No list/query/delete. Faults affect this run's prefix only and require an extra
explicit flag. Use a separate test principal; never the normal runtime identity.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import uuid
from datetime import timedelta

from ..errors import AppError
from .composition import CentralConfig, BoundRepository, central_service
from .identity import digest
from .pricing import LLM, make_stage
from .types import Accounting


class SyntheticStore:
    def __init__(self, base):
        self.base = base
        self.prefix = "syntheticRuns/" + uuid.uuid4().hex + "/"

    def run(self, name, action):
        prefix = self.prefix
        def isolated(tx):
            class View:
                @property
                def now(self): return tx.now
                def get(self, path): return tx.get(prefix + path)
                def set(self, path, value): tx.set(prefix + path, value)
            return action(View())
        return self.base.run(name, isolated)


async def exercise(config, service, *, faults=False):
    if (not config.database.startswith("synthetic-")
            or not config.environment.startswith("synthetic-")
            or not config.namespace.startswith("synthetic-")):
        raise RuntimeError("Harness requires a dedicated synthetic database and identity.")
    authoritative = await service.repository.configuration()
    store = SyntheticStore(service.repository.store)
    # Copy validated policy, not environment budget estimates; no normal ledger
    # is ever touched. Unique root isolates counter bootstrap and fault injection.
    store.run("bootstrap", lambda tx: tx.set("control/current", authoritative.model_dump()))
    repo = BoundRepository(store, service.fingerprints, config)
    user, owner = "synthetic-" + uuid.uuid4().hex, digest("synthetic-owner", uuid.uuid4().hex)
    now = store.run("clock", lambda tx: (tx.get("control/current"), tx.now)[1])
    nonce = now.strftime("%Y%m%d") + "." + uuid.uuid4().hex
    stage = make_stage("llm", LLM.model, 220, digest("synthetic-payload"))
    async def reserve(key, payload=b"synthetic-ledger-input"):
        return await repo.reserve(user, "weekly_narrative", key, payload, [stage],
                                  authoritative.version, "synthetic-policy.v1")
    def require(value):
        if not value:
            raise RuntimeError("Synthetic ledger invariant failed.")
    record, fresh = await reserve(nonce)
    require(fresh)
    require(await repo.claim(record.id, "llm", owner, stage.payload_digest))
    require(not await repo.claim(record.id, "llm", owner, stage.payload_digest))
    await repo.reconcile(record.id, "llm", owner, Accounting(stage_id="llm",
        pricing_version=LLM.version, observed_model=LLM.model, usage_status="KNOWN",
        input_usage=100, output_usage=10, parse_status="OK"))
    try:
        await reserve(nonce, b"synthetic-conflicting-input")
    except AppError as error:
        require(error.code == "IDEMPOTENCY_CONFLICT")
    else:
        require(False)
    second, _ = await reserve(now.strftime("%Y%m%d") + "." + uuid.uuid4().hex)
    require(await repo.claim(second.id, "llm", owner, stage.payload_digest))
    await repo.mark_unknown(second.id, "llm", owner)
    minutes = {"minute/" + digest(config.environment,
        digest("subject-v1", config.namespace, user), "weekly_narrative",
        item.admitted_at.strftime("%Y%m%d%H%M")) for item in (record, second)}
    def inspect(tx):
        count = sum(tx.get(path)["count"] for path in minutes)
        counters = [repo._counter(tx, path) for path in (record.user_bucket, record.global_bucket)]
        unknown = tx.get("reservations/" + second.id)
        return count, counters, unknown
    count, counters, unknown = store.run("inspect", inspect)
    require(count == 2)
    require(all(c.held + c.charged <= c.budget and c.admissions == 2 for c in counters))
    require(unknown["stages"][0]["state"] == "UNKNOWN")
    require(all(c.held >= stage.reserved for c in counters))
    outcomes = ["bootstrap", "minute", "user_day", "global_day", "reserve",
                "single_dispatch", "known_settlement", "unknown_hold", "idempotency_conflict"]
    if faults:
        # Isolated writes only. Never alter base control, normal counters or IAM.
        def age_synthetic_record(tx):
            old = tx.get("reservations/" + second.id)
            old["admitted_at"] -= timedelta(minutes=6)
            tx.set("reservations/" + second.id, old)
        store.run("fault", age_synthetic_record)
        await repo.recover(second.id)
        conservative = store.run("inspect", lambda tx: tx.get("reservations/" + second.id))
        require(conservative["stages"][0]["state"] == "SETTLED_CONSERVATIVE")
        require(conservative["stages"][0]["charged"] == stage.reserved)
        _, settled_counters, _ = store.run("inspect", inspect)
        require(all(c.held == 0 and c.charged >= stage.reserved for c in settled_counters))
        outcomes.append("conservative_settlement")
        store.run("fault", lambda tx: tx.set("blocks/" + stage.profile_id, {"synthetic": True}))
        try:
            await reserve(now.strftime("%Y%m%d") + "." + uuid.uuid4().hex)
        except AppError as error:
            require(error.code == "COST_BOUND_UNAVAILABLE")
        else:
            require(False)
        store.run("fault", lambda tx: tx.set("counterMarkers/" + digest(record.global_bucket),
                                            {"synthetic_corruption": True}))
        try:
            await repo.recover(second.id)
        except AppError:
            pass
        else:
            require(False)
        outcomes.extend(["profile_block", "marker_corruption"])
    return {"checks": outcomes, "provider_calls": 0, "result": "PASS"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute-synthetic-ledger", action="store_true")
    parser.add_argument("--fault-injection", action="store_true")
    args = parser.parse_args()
    if not args.execute_synthetic_ledger:
        parser.error("Explicit synthetic ledger execution approval is required.")
    try:
        import os
        config = CentralConfig.parse(os.environ)
        # Reject before constructing ADC client or touching a store.
        if not all(x.startswith("synthetic-") for x in
                   (config.database, config.environment, config.namespace)):
            raise RuntimeError()
        print(json.dumps(asyncio.run(exercise(config, central_service(config), faults=args.fault_injection))))
    except Exception:
        print('{"result":"FAIL","provider_calls":0}')
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
