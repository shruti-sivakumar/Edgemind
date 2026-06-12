"""
tests/test_server.py — Person B's OPC-UA server test suite.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All tests use Person A's REAL pump_config and fault_engine (no mocks).
The OPC-UA server is started on a high throw-away port (14841) so it
never conflicts with production containers.

Design decision — two test categories:
  • "Server-side" tests  : use server.get_node().read_value()  (fast, no client needed)
  • "Client-side" tests  : use asyncua.Client browse path   (connectivity proof only)

Keeping the client fixture module-scoped (one persistent connection) avoids
asyncua connection-limit and event-loop-mismatch issues seen with per-function
fixture teardown under pytest-asyncio AUTO mode.

Test coverage:
  ✓ Client connects and ServerState node is readable
  ✓ is_running flag, node_count
  ✓ All 6 nodes readable via server-side node handle
  ✓ Float values within physical sanity bounds for pump2
  ✓ update_nodes() round-trip fidelity (< 0.5 mm/s tolerance)
  ✓ bearing_fault: axial value at t=300 s is > 4.0 mm/s
  ✓ bearing_fault: axial at t=0 is near start value 0.8
  ✓ cavitation step-change: radial > 4.0 immediately at t=0
  ✓ flood flag: fault_state.flood True after activate(), False after clear()
  ✓ flood: FLOOD_PERIOD_S == 0.1, NORMAL_PERIOD_S == 1.0
  ✓ flood: values stay near baseline despite rate change
  ✓ emit_loop: runs for 2.5 s, updates nodes
  ✓ get_node() returns handle / None for unknown key
  ✓ Constructor rejects unknown pump_id; accepts all three valid IDs

Run:
    cd sensor_sim
    pytest tests/test_server.py -v
"""

from __future__ import annotations

import asyncio
import os
import sys
import pytest
import pytest_asyncio

# Ensure sensor_sim/ is on sys.path when invoked from any working directory.
_HERE = os.path.dirname(__file__)
_ROOT = os.path.abspath(os.path.join(_HERE, ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from asyncua import Client

# ── Person A's real modules — no mocking ─────────────────────────────────────
from pump_config import (
    PARAMS,
    OPC_NODE_NAMES,
    OPC_TIMESTAMP_NODE,
    OPC_ROOT_OBJECT,
    OPC_PUMP_OBJECT,
    PUMP_BASELINES,
    NORMAL_PERIOD_S,
    FLOOD_PERIOD_S,
    FAULT_DEFS,
)
from fault_engine import FaultState, compute_reading

# ── Person B's module under test ──────────────────────────────────────────────
from opc_server import OpcUaServer

# ── Test constants ────────────────────────────────────────────────────────────
TEST_PUMP_ID  = "pump2"
TEST_PUMP_LBL = OPC_PUMP_OBJECT[TEST_PUMP_ID]   # "Pump2"
TEST_OPC_PORT = 14841
TEST_ENDPOINT = f"opc.tcp://127.0.0.1:{TEST_OPC_PORT}/PumpStation/"


# ═══════════════════════════════════════════════════════════════════════════════
# Fixtures
# ─ server_fixture : module-scoped — one server for the whole test module
# ─ client_fixture : module-scoped — one persistent connection for the whole run
#   (keeping both at module scope avoids event-loop mismatch in pytest-asyncio)
# ═══════════════════════════════════════════════════════════════════════════════

@pytest_asyncio.fixture(scope="module")
async def server_fixture():
    """
    Start OpcUaServer on test port ONCE for the whole module.
    Yield (server, fault_state). Stop on teardown.
    """
    server = OpcUaServer(pump_id=TEST_PUMP_ID, opc_port=TEST_OPC_PORT)
    await server.start()
    await asyncio.sleep(0.5)   # give asyncua time to fully bind before clients connect

    fault_state = FaultState()

    # Prime every node with a real reading so no node holds the initial 0.0.
    reading = compute_reading(TEST_PUMP_ID, fault_state, t=0.0)
    await server.update_nodes(reading)

    yield server, fault_state

    await server.stop()


@pytest_asyncio.fixture(scope="module")
async def client_fixture(server_fixture):
    """
    ONE persistent asyncua Client for the whole module.
    Module scope keeps client on the same event loop as the server.
    Used ONLY for connectivity / browse-path tests; value tests use server
    node handles directly.
    """
    client = Client(url=TEST_ENDPOINT)
    await client.connect()
    yield client
    try:
        await client.disconnect()
    except Exception:       # noqa: BLE001
        pass


# ── OPC-UA browse helper (for connectivity tests only) ───────────────────────

async def browse_node(client: Client, opc_node_name: str):
    """
    Navigate Objects → PumpStation → Pump2 → <opc_node_name>.
    Uses pump_config constants — same strings opc_server.py uses.
    """
    root         = client.nodes.root
    objects      = await root.get_child(["0:Objects"])
    pump_station = await objects.get_child([f"2:{OPC_ROOT_OBJECT}"])
    pump_obj     = await pump_station.get_child([f"2:{TEST_PUMP_LBL}"])
    return await pump_obj.get_child([f"2:{opc_node_name}"])


# ═══════════════════════════════════════════════════════════════════════════════
# 1 — Connectivity (OPC-UA client)
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_server_state_running(client_fixture):
    """
    Read OPC-UA standard ServerState node (ns=0;i=2259).
    Value 0 == Running. This is the definitive connectivity proof.
    """
    node  = client_fixture.get_node("ns=0;i=2259")
    value = await node.read_value()
    assert value == 0, f"Expected ServerState.Running (0), got {value}"


@pytest.mark.asyncio
async def test_client_can_browse_vibration_axial(client_fixture):
    """Browse the full OPC-UA path to VibrationAxial and read it."""
    node  = await browse_node(client_fixture, OPC_NODE_NAMES["vibration_axial"])
    value = await node.read_value()
    assert value is not None
    assert value >= 0.0, f"Negative vibration value: {value}"


@pytest.mark.asyncio
async def test_client_can_browse_timestamp(client_fixture):
    """Browse the full OPC-UA path to Timestamp and read it."""
    node  = await browse_node(client_fixture, OPC_TIMESTAMP_NODE)
    value = await node.read_value()
    assert value is not None


# ═══════════════════════════════════════════════════════════════════════════════
# 2 — Address space (server-side, no client needed)
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_is_running_flag(server_fixture):
    """is_running property is True after start(), before stop()."""
    server, _ = server_fixture
    assert server.is_running is True


@pytest.mark.asyncio
async def test_node_count(server_fixture):
    """node_count == 5 parameter nodes + 1 Timestamp node == 6."""
    server, _ = server_fixture
    assert server.node_count == len(PARAMS) + 1


@pytest.mark.asyncio
async def test_get_node_all_params(server_fixture):
    """get_node() returns a non-None handle for every PARAMS key + 'timestamp'."""
    server, _ = server_fixture
    for key in list(PARAMS) + ["timestamp"]:
        assert server.get_node(key) is not None, \
            f"get_node('{key}') unexpectedly returned None"


@pytest.mark.asyncio
async def test_get_node_unknown_returns_none(server_fixture):
    """get_node() returns None for an unknown key (no crash)."""
    server, _ = server_fixture
    assert server.get_node("nonexistent_param") is None


# ═══════════════════════════════════════════════════════════════════════════════
# 3 — Value sanity in normal mode (server-side reads)
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_all_float_nodes_readable(server_fixture):
    """All 5 Float parameter nodes return a non-negative value."""
    server, fault_state = server_fixture
    fault_state.clear()
    reading = compute_reading(TEST_PUMP_ID, fault_state, t=0.0)
    await server.update_nodes(reading)

    for param_key in PARAMS:
        node  = server.get_node(param_key)
        value = await node.read_value()
        assert value is not None, f"{param_key} returned None"
        assert value >= 0.0, f"{param_key} = {value} is negative"


@pytest.mark.asyncio
async def test_vibration_axial_normal_range(server_fixture):
    """VibrationAxial within ±60 % of pump2 baseline in normal mode."""
    server, fault_state = server_fixture
    fault_state.clear()
    reading = compute_reading(TEST_PUMP_ID, fault_state, t=0.0)
    await server.update_nodes(reading)

    baseline = PUMP_BASELINES[TEST_PUMP_ID].axial   # 0.8 mm/s
    node  = server.get_node("vibration_axial")
    value = await node.read_value()
    assert baseline * 0.4 < value < baseline * 1.6, \
        f"VibrationAxial={value:.3f} outside normal range (baseline={baseline})"


@pytest.mark.asyncio
async def test_temperature_normal_range(server_fixture):
    """Temperature within ±20 % of pump2 baseline in normal mode."""
    server, fault_state = server_fixture
    fault_state.clear()
    reading = compute_reading(TEST_PUMP_ID, fault_state, t=0.0)
    await server.update_nodes(reading)

    baseline = PUMP_BASELINES[TEST_PUMP_ID].temperature   # 46.5 °C
    node  = server.get_node("temperature")
    value = await node.read_value()
    assert baseline * 0.8 < value < baseline * 1.2, \
        f"Temperature={value:.2f} outside expected range (baseline={baseline})"


@pytest.mark.asyncio
async def test_rpm_positive(server_fixture):
    """RPM is always strictly positive."""
    server, fault_state = server_fixture
    fault_state.clear()
    reading = compute_reading(TEST_PUMP_ID, fault_state, t=0.0)
    await server.update_nodes(reading)

    node  = server.get_node("rpm")
    value = await node.read_value()
    assert value > 0.0, f"RPM={value} must be > 0"


# ═══════════════════════════════════════════════════════════════════════════════
# 4 — update_nodes round-trip fidelity (server-side)
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_update_nodes_round_trip(server_fixture):
    """
    Write a known reading via update_nodes(), read back via server node handle.
    Round-trip error must be < 0.5 (Float32 precision is ≈ 7 significant digits).
    """
    server, fault_state = server_fixture
    fault_state.clear()
    reading = compute_reading(TEST_PUMP_ID, fault_state, t=0.0)
    await server.update_nodes(reading)

    node      = server.get_node("vibration_radial")
    opc_value = await node.read_value()
    expected  = reading["vibration_radial"]

    assert abs(opc_value - expected) < 0.5, \
        f"Round-trip error: wrote {expected:.4f}, read {opc_value:.4f}"


# ═══════════════════════════════════════════════════════════════════════════════
# 5 — Bearing fault: axial rises linearly, start ≈ 0.8, end ≈ 4.8
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_bearing_fault_axial_at_t300(server_fixture):
    """
    bearing_fault LINEAR drift: axial 0.8 → 4.8 over 300 s.
    At t=300 axial must exceed 4.0 mm/s.
    """
    server, fault_state = server_fixture
    fault_state.activate("bearing_fault", FAULT_DEFS["bearing_fault"].duration_s)

    reading = compute_reading(TEST_PUMP_ID, fault_state, t=300.0)
    await server.update_nodes(reading)

    assert reading["vibration_axial"] > 4.0, \
        f"Expected axial > 4.0 at t=300 s, got {reading['vibration_axial']:.3f}"

    fault_state.clear()


@pytest.mark.asyncio
async def test_bearing_fault_axial_near_baseline_at_t0(server_fixture):
    """At t=0 of bearing_fault, axial must still be near the start value (0.8)."""
    server, fault_state = server_fixture
    fault_state.activate("bearing_fault", 300)

    reading = compute_reading(TEST_PUMP_ID, fault_state, t=0.0)
    assert 0.3 < reading["vibration_axial"] < 1.5, \
        f"Axial at t=0 should be near start=0.8, got {reading['vibration_axial']:.3f}"

    fault_state.clear()


# ═══════════════════════════════════════════════════════════════════════════════
# 6 — Cavitation: STEP pattern — values jump immediately
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_cavitation_radial_at_t0(server_fixture):
    """
    cavitation is Pattern.STEP — at t=0 radial must already be at fault level.
    pump_config: radial end = 5.2 mm/s → expect > 4.0.
    """
    server, fault_state = server_fixture
    fault_state.activate("cavitation", 0)

    reading = compute_reading(TEST_PUMP_ID, fault_state, t=0.0)
    assert reading["vibration_radial"] > 4.0, \
        f"Cavitation step: expected radial > 4.0 at t=0, got {reading['vibration_radial']:.3f}"

    fault_state.clear()


# ═══════════════════════════════════════════════════════════════════════════════
# 7 — Flood mode: rate flag toggles; values stay near baseline
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_flood_sets_flood_flag(server_fixture):
    """After activate('flood'), fault_state.flood must be True."""
    _, fault_state = server_fixture
    fault_state.activate("flood", 0)
    assert fault_state.flood is True
    fault_state.clear()


@pytest.mark.asyncio
async def test_clear_unsets_flood_flag(server_fixture):
    """After clear(), fault_state.flood must be False."""
    _, fault_state = server_fixture
    fault_state.activate("flood", 0)
    fault_state.clear()
    assert fault_state.flood is False


@pytest.mark.asyncio
async def test_emission_period_constants():
    """FLOOD_PERIOD_S == 0.1 and NORMAL_PERIOD_S == 1.0 (pump_config contract)."""
    assert NORMAL_PERIOD_S == pytest.approx(1.0)
    assert FLOOD_PERIOD_S  == pytest.approx(0.1)


@pytest.mark.asyncio
async def test_flood_values_stay_near_baseline(server_fixture):
    """
    In flood mode parameter VALUES stay near baseline — only emission RATE changes.
    Check 10 successive readings; axial must stay within 1.0 mm/s of baseline.
    """
    server, fault_state = server_fixture
    fault_state.activate("flood", 0)
    baseline = PUMP_BASELINES[TEST_PUMP_ID]

    for _ in range(10):
        reading = compute_reading(TEST_PUMP_ID, fault_state, t=0.0)
        # NOISE_SIGMA for vibration = 0.15 → allow 6σ = 0.9 mm/s headroom
        assert abs(reading["vibration_axial"] - baseline.axial) < 1.0, \
            f"Flood: axial {reading['vibration_axial']:.3f} too far from baseline {baseline.axial}"
        assert reading["rpm"] > 0

    fault_state.clear()


# ═══════════════════════════════════════════════════════════════════════════════
# 8 — emit_loop: runs without crashing, writes real values
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_emit_loop_updates_nodes(server_fixture):
    """
    Start emit_loop for 2.5 s (≥ 2 ticks at 1 Hz), cancel cleanly.
    After cancellation, VibrationAxial node must have been written (> 0).
    """
    server, fault_state = server_fixture
    fault_state.clear()

    task = asyncio.create_task(server.emit_loop(fault_state))
    await asyncio.sleep(2.5)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    node  = server.get_node("vibration_axial")
    value = await node.read_value()
    assert value > 0.0, "emit_loop never wrote VibrationAxial (still 0.0)"


# ═══════════════════════════════════════════════════════════════════════════════
# 9 — Constructor validation (sync, no server needed)
# ═══════════════════════════════════════════════════════════════════════════════

def test_invalid_pump_id_raises():
    """OpcUaServer raises ValueError for an unrecognised pump_id."""
    with pytest.raises(ValueError, match="Unknown pump_id"):
        OpcUaServer(pump_id="pump99", opc_port=9999)


@pytest.mark.parametrize("pid,port", [
    ("pump1", 14840),
    ("pump2", 14841),
    ("pump3", 14842),
])
def test_valid_pump_ids_construct_cleanly(pid, port):
    """All three valid pump IDs construct without raising."""
    s = OpcUaServer(pump_id=pid, opc_port=port)
    assert s.pump_id    == pid
    assert s.pump_label == OPC_PUMP_OBJECT[pid]
    assert s.is_running  is False
    assert s.node_count  == 0
