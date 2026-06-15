import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock
from edgemind_server.correlation_filter import CorrelationFilter, MONITORED_NAMESPACES

def make_finding(anomaly_type, severity, pod, namespace, agent):
    return {
        "finding_id": "test-id",
        "anomaly_type": anomaly_type,
        "severity": severity,
        "pod": pod,
        "namespace": namespace,
        "agent": agent,
        "timestamp": "2026-01-01T00:00:00+00:00",
        "current_value": 1.0,
        "evidence": ["test"],
        "affected_pods": [],
        "pvc_name": None,
        "eta_minutes": None,
    }


async def test_namespace_filter_blocks_monitoring():
    triggered = []
    cf = CorrelationFilter(MagicMock(), lambda b: triggered.append(b))
    cf._add_to_window(make_finding("cpu_spike", "critical", "edgemind-agents", "monitoring", "cpu"))
    assert len(cf._window) == 0


async def test_namespace_filter_allows_pump_station():
    triggered = []
    cf = CorrelationFilter(MagicMock(), lambda b: triggered.append(b))
    cf._add_to_window(make_finding("cpu_spike", "critical", "opc-ua-collector", "pump-station", "cpu"))
    assert len(cf._window) == 1


async def test_dedup_same_anomaly_pod():
    cf = CorrelationFilter(MagicMock(), AsyncMock())
    f = make_finding("cpu_spike", "warning", "opc-ua-collector", "pump-station", "cpu")
    cf._add_to_window(f)
    cf._add_to_window(f)
    assert len(cf._window) == 1


async def test_single_agent_significant_triggers():
    cf = CorrelationFilter(MagicMock(), AsyncMock())
    cf._last_trigger_time = -999.0
    cf._add_to_window(make_finding("pump_health_critical", "warning", "health-scorer", "pump-station", "network_log"))
    assert cf._should_trigger() == "single_agent_significant"


async def test_oom_strings_trigger():
    cf = CorrelationFilter(MagicMock(), AsyncMock())
    cf._last_trigger_time = -999.0
    cf._add_to_window(make_finding("oomkill_detected", "critical", "feature-extractor", "pump-station", "memory"))
    assert cf._should_trigger() == "single_critical"


async def test_k8s_oomkill_string_triggers():
    cf = CorrelationFilter(MagicMock(), AsyncMock())
    cf._last_trigger_time = -999.0
    cf._add_to_window(make_finding("k8s_oomkill", "critical", "feature-extractor", "pump-station", "network_log"))
    assert cf._should_trigger() == "single_critical"


async def test_volume_mount_failure_does_not_trigger_alone():
    cf = CorrelationFilter(MagicMock(), AsyncMock())
    cf._last_trigger_time = -999.0
    cf._add_to_window(make_finding("volume_mount_failure", "critical", "sensor-sim-1", "pump-station", "network_log"))
    assert cf._should_trigger() is None


async def test_multi_agent_triggers():
    cf = CorrelationFilter(MagicMock(), AsyncMock())
    cf._last_trigger_time = -999.0
    # Use anomaly types NOT in SINGLE_AGENT_SUFFICIENT — needs 2 agents to trigger
    cf._add_to_window(make_finding("log_error_surge", "warning", "opc-ua-collector", "pump-station", "network_log"))
    cf._add_to_window(make_finding("write_burst", "warning", "batch-sync", "pump-station", "storage"))
    assert cf._should_trigger() == "multi_agent"


async def test_cooldown_blocks_trigger():
    import time
    cf = CorrelationFilter(MagicMock(), AsyncMock())
    cf._last_trigger_time = time.monotonic()  # just triggered
    cf._add_to_window(make_finding("pump_health_critical", "warning", "health-scorer", "pump-station", "network_log"))
    assert cf._should_trigger() is None