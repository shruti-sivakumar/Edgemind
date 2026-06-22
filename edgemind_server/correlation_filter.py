"""
correlation_filter.py — deterministic correlation filter.

Reads findings from Redis (BRPOP), groups them into 45-second windows,
and triggers the AI orchestrator when:
  - 2+ findings from DIFFERENT agents arrive within the window, OR
  - 1 CRITICAL severity finding arrives (single critical = immediate trigger)

No LLM involved here. Pure Python logic.

Deduplication within window: same (anomaly_type, pod) pair = 1 finding kept.
"""

import asyncio
import json
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

import redis.asyncio as aioredis

log = logging.getLogger(__name__)

CORRELATION_WINDOW_S = 45
REDIS_BRPOP_TIMEOUT = 1  # seconds — keeps loop responsive to shutdown
ORCHESTRATOR_COOLDOWN_S = 600

# Minimum findings to trigger orchestrator
MIN_AGENTS_FOR_TRIGGER = 2   # 2+ different agents = trigger

# Only these anomaly types bypass multi-agent requirement when critical.
# Noisy transient types (volume_mount_failure, log_error_surge) require corroboration.

# cpu_spike and network_flood are intentionally excluded — both are relative-
# threshold detectors that false-positive on near-idle pods (cpu_spike: z-score
# blows up on tiny std; network_flood: fires on a 2x bump even at ~0 MB/s, e.g.
# feature-extractor's periodic InfluxDB reads). They must be corroborated by
# another agent to trigger. The flood cascade still fires because it produces
# both network_flood AND cpu_spike (network_log + cpu = 2 agents → multi_agent).
CRITICAL_ANOMALY_TYPES_IMMEDIATE = {
    "oomkill_detected", "k8s_oomkill",
    "memory_leak", "pvc_fill",
    "io_saturation",
}

# Only findings from these namespaces are considered
MONITORED_NAMESPACES = {"pump-station"}

SINGLE_AGENT_SUFFICIENT = {
    "pump_health_critical",
    "oomkill_detected", "k8s_oomkill",
    "memory_leak",
    "io_saturation",
}


@dataclass
class CorrelatedSignalBundle:
    """Package passed to the AI orchestrator."""
    findings: List[Dict[str, Any]]
    unique_agents: List[str]
    unique_pods: List[str]
    window_start: datetime
    window_end: datetime
    trigger_reason: str   # "multi_agent" | "single_critical"
    severity_counts: Dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "findings": self.findings,
            "unique_agents": self.unique_agents,
            "unique_pods": self.unique_pods,
            "window_start": self.window_start.isoformat(),
            "window_end": self.window_end.isoformat(),
            "trigger_reason": self.trigger_reason,
            "severity_counts": self.severity_counts,
            "finding_count": len(self.findings),
        }


class CorrelationFilter:
    def __init__(
        self,
        redis: aioredis.Redis,
        on_trigger: Callable[[CorrelatedSignalBundle], None],
        findings_key: str = "edgemind:findings",
    ):
        self._redis = redis
        self._on_trigger = on_trigger
        self._findings_key = findings_key
        self._window: List[Dict[str, Any]] = []
        self._window_start: Optional[float] = None
        self._seen_keys: set = set()  # dedup within window
        self._last_trigger_time: float = -999.0
        self._pending_trigger: Optional[str] = None

    def _add_to_window(self, finding: Dict[str, Any]) -> None:
        """Add finding to current window, deduplicating by (anomaly_type, pod)."""
        if finding.get("namespace") not in MONITORED_NAMESPACES:
            log.debug("Ignoring finding from non-monitored namespace: %s", finding.get("namespace"))
            return
        dedup_key = (finding.get("anomaly_type", ""), finding.get("pod", ""))
        if dedup_key in self._seen_keys:
            log.debug("Dedup: skipping duplicate %s on %s", *dedup_key)
            return
        self._seen_keys.add(dedup_key)
        self._window.append(finding)

        if self._window_start is None:
            self._window_start = time.monotonic()

    def _should_trigger(self) -> Optional[str]:
        if not self._window:
            return None

        now = time.monotonic()
        if (now - self._last_trigger_time) < ORCHESTRATOR_COOLDOWN_S:
            return None

        for f in self._window:
            if f.get("severity") == "critical" and \
                    f.get("anomaly_type") in CRITICAL_ANOMALY_TYPES_IMMEDIATE:
                return "single_critical"

        for f in self._window:
            if f.get("anomaly_type") in SINGLE_AGENT_SUFFICIENT:
                return "single_agent_significant"

        agents = {f.get("agent") for f in self._window if f.get("agent")}
        if len(agents) >= MIN_AGENTS_FOR_TRIGGER:
            return "multi_agent"

        return None

    def _window_expired(self) -> bool:
        if self._window_start is None:
            return False
        return (time.monotonic() - self._window_start) >= CORRELATION_WINDOW_S

    def _flush_window(self, trigger_reason: str) -> None:
        """Build CorrelatedSignalBundle and pass to orchestrator."""
        now = datetime.now(timezone.utc)
        agents = list({f.get("agent", "unknown") for f in self._window})
        pods = list({f.get("pod", "unknown") for f in self._window if f.get("pod")})
        sev_counts: Dict[str, int] = defaultdict(int)
        for f in self._window:
            sev_counts[f.get("severity", "unknown")] += 1

        bundle = CorrelatedSignalBundle(
            findings=list(self._window),
            unique_agents=agents,
            unique_pods=pods,
            window_start=now,
            window_end=now,
            trigger_reason=trigger_reason,
            severity_counts=dict(sev_counts),
        )
        log.info(
            "Correlation triggered: reason=%s agents=%s pods=%s findings=%d",
            trigger_reason, agents, pods, len(self._window),
        )
        self._last_trigger_time = time.monotonic()
        self._reset_window()
        asyncio.create_task(self._on_trigger(bundle))

    def _reset_window(self) -> None:
        self._window = []
        self._window_start = None
        self._seen_keys = set()
        self._pending_trigger = None

    def reset_cooldown(self) -> None:
        """Reset cooldown so the next fault triggers immediately. Call when alerts are cleared."""
        self._last_trigger_time = -999.0
        self._reset_window()

    async def run(self) -> None:
        """Main loop. Runs forever, reading findings from Redis."""
        log.info("Correlation filter running (window=%ds)", CORRELATION_WINDOW_S)
        while True:
            try:
                # BRPOP with timeout so we can check window expiry
                result = await self._redis.brpop(
                    self._findings_key, timeout=REDIS_BRPOP_TIMEOUT
                )
                if result:
                    _, payload = result
                    try:
                        finding = json.loads(payload)
                        self._add_to_window(finding)
                        log.debug(
                            "Finding added to window: %s from %s",
                            finding.get("anomaly_type"), finding.get("agent"),
                        )
                    except json.JSONDecodeError as e:
                        log.warning("Bad JSON from Redis: %s", e)

                # Check trigger conditions after every finding or timeout.
                # single_critical and multi_agent flush immediately.
                # single_agent_significant defers until window expiry so all
                # correlated findings accumulate before the AI sees the bundle.
                trigger = self._should_trigger()
                flushed = False
                if trigger in ("single_critical", "multi_agent"):
                    self._flush_window(trigger)
                    flushed = True
                elif trigger == "single_agent_significant":
                    if self._pending_trigger is None:
                        self._pending_trigger = trigger
                        log.debug("Pending trigger set: waiting for window to expire")

                if not flushed and self._window_expired():
                    if self._pending_trigger:
                        self._flush_window(self._pending_trigger)
                    else:
                        log.debug("Window expired with no trigger, resetting")
                        self._reset_window()

            except asyncio.CancelledError:
                raise
            except Exception as e:
                log.error("Correlation filter error: %s", e, exc_info=True)
                await asyncio.sleep(1)
