"""Bounded, process-local operational counters; no content/identity labels.

Not a public endpoint or accounting authority. An operator may consume snapshot()
through a reviewed metrics exporter; Cloud Monitoring remains the RSS/container
authority. No periodic tasks, logging, or network calls are installed here.
"""
from __future__ import annotations

import os
import re
import threading
import uuid
from pathlib import Path


EVENTS = frozenset({
    "audio_acquire", "audio_release", "audio_capacity_rejected",
    "upload_started", "upload_body_received", "upload_timeout",
    "duration_verified", "duration_rejected", "child_started", "child_reaped",
    "provider_dispatch", "transaction_success", "transaction_failure",
    "transaction_retry", "transaction_latency_ms", "quota_accepted", "quota_rejected",
    "claim_completed", "reconcile_completed", "unknown_completed", "cancel_completed",
    "recover_completed",
    "transaction_permission_denied", "transaction_contention", "transaction_timeout",
    "transaction_unavailable", "quota_limit", "quota_integrity_or_config",
    "quota_idempotency", "quota_cost_bound",
    "duration_format", "duration_metadata", "duration_too_long", "duration_unverified",
})
GAUGES = frozenset({"audio_active", "children_active"})


class Telemetry:
    def __init__(self):
        self._lock = threading.Lock()
        self._values = dict.fromkeys(EVENTS | GAUGES, 0)
        self.process = uuid.uuid4().hex
        revision = os.getenv("K_REVISION", "local")
        self.revision = revision if re.fullmatch(r"[a-z0-9-]{1,100}", revision) else "unknown"

    def add(self, name, amount=1):
        if name not in EVENTS | GAUGES or type(amount) is not int:
            return
        with self._lock:
            self._values[name] = max(0, min((1 << 63) - 1, self._values[name] + amount))

    def snapshot(self):
        with self._lock:
            return {"process": self.process, "revision": self.revision,
                    "worker_contract": 1, "metrics": dict(self._values)}


METRICS = Telemetry()


def memory_snapshot():
    """On-demand numeric Linux sample only; no filenames/process arguments.

    /tmp figure is filesystem-wide used space, NOT this service's attribution.
    Missing cgroup/proc readings are unavailable (None), never a false zero.
    No exporter, sampler, stdout, or network is started by the application.
    """
    def number(path):
        try:
            raw = Path(path).read_text()[:128].strip()
            return int(raw) if raw.isdecimal() else None
        except (OSError, ValueError):
            return None
    rss = None
    try:
        fields = Path("/proc/self/statm").read_text().split()
        rss = int(fields[1]) * os.sysconf("SC_PAGE_SIZE")
    except (OSError, ValueError, IndexError):
        pass
    try:
        stats = os.statvfs("/tmp")
        tmp = (stats.f_blocks - stats.f_bfree) * stats.f_frsize
    except OSError:
        tmp = None
    return {"rss_bytes": rss,
            "cgroup_bytes": number("/sys/fs/cgroup/memory.current"),
            "tmp_filesystem_used_bytes": tmp, **METRICS.snapshot()}
