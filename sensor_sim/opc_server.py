"""
opc_server.py — Person B's primary deliverable.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Wraps asyncua.Server for one pump container. Exposes three public methods:

  start()                   — init server, build OPC-UA address space, bind port
  update_nodes(reading)     — write one compute_reading() dict to OPC-UA nodes
  emit_loop(fault_state)    — async coroutine: tick → compute → publish → sleep

OPC-UA node tree (Phase-0 contract, constants owned by pump_config.py):

    Objects/
      PumpStation/              ← OPC_ROOT_OBJECT
        Pump1 | Pump2 | Pump3   ← OPC_PUMP_OBJECT[pump_id]
          VibrationRadial       ← OPC_NODE_NAMES[PARAM_RADIAL]     Float
          VibrationTangential   ← OPC_NODE_NAMES[PARAM_TANGENTIAL]  Float
          VibrationAxial        ← OPC_NODE_NAMES[PARAM_AXIAL]       Float
          Temperature           ← OPC_NODE_NAMES[PARAM_TEMPERATURE] Float
          RPM                   ← OPC_NODE_NAMES[PARAM_RPM]         Float
          Timestamp             ← OPC_TIMESTAMP_NODE                DateTime

All constants come from pump_config (Person A). Never hardcode numbers here.
All values come from compute_reading() (Person A). Never do math here.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple

from asyncua import Server, ua

# ── Imports from Person A's pump_config (Phase-0 contract constants) ─────────
from pump_config import (
    OPC_NAMESPACE_URI,    # "http://edgemind.abb/pump-station"
    OPC_ROOT_OBJECT,      # "PumpStation"
    OPC_PUMP_OBJECT,      # {"pump1": "Pump1", "pump2": "Pump2", "pump3": "Pump3"}
    OPC_NODE_NAMES,       # {param_key: "VibrationRadial", ...}
    OPC_TIMESTAMP_NODE,   # "Timestamp"
    PARAMS,               # ["vibration_radial", "vibration_tangential", ...]
    PUMP_IDS,             # ["pump1", "pump2", "pump3"]
    NORMAL_PERIOD_S,      # 1.0 s  (1 Hz)
    FLOOD_PERIOD_S,       # 0.1 s  (10 Hz)
)

# ── Imports from Person A's fault_engine ─────────────────────────────────────
from fault_engine import FaultState, compute_reading

log = logging.getLogger(__name__)

# ── Internal type alias ───────────────────────────────────────────────────────
# Node map key: (pump_id, param_key)  e.g. ("pump2", "vibration_axial")
NodeKey = Tuple[str, str]
NodeMap = Dict[NodeKey, object]   # asyncua variable node handles


# ═══════════════════════════════════════════════════════════════════════════════
class OpcUaServer:
    """
    OPC-UA server for one pump container.

    Typical usage inside asyncio.gather():

        server = OpcUaServer(pump_id="pump2", opc_port=4841)
        await server.start()
        # Then in gather:
        await server.emit_loop(fault_state)
    """

    def __init__(self, pump_id: str, opc_port: int = 4840) -> None:
        if pump_id not in PUMP_IDS:
            raise ValueError(
                f"Unknown pump_id {pump_id!r}. Valid: {PUMP_IDS}"
            )
        self.pump_id    = pump_id
        self.pump_label = OPC_PUMP_OBJECT[pump_id]   # e.g. "Pump2"
        self.opc_port   = opc_port

        self._server:  Optional[Server] = None
        self._ns_idx:  int = 0
        self._nodes:   NodeMap = {}        # populated by _build_address_space
        self._running: bool = False

    # ──────────────────────────────────────────────────────────────────────────
    # Lifecycle
    # ──────────────────────────────────────────────────────────────────────────

    async def start(self) -> None:
        """
        Initialise asyncua.Server, register the agreed namespace URI,
        build the OPC-UA address space, then bind to the TCP endpoint.
        """
        self._server = Server()
        await self._server.init()

        endpoint = f"opc.tcp://0.0.0.0:{self.opc_port}/PumpStation/"
        self._server.set_endpoint(endpoint)
        self._server.set_server_name(f"EdgeMind PumpStation – {self.pump_label}")

        # Register the namespace URI agreed in Phase 0.
        self._ns_idx = await self._server.register_namespace(OPC_NAMESPACE_URI)

        await self._build_address_space()

        await self._server.start()
        self._running = True
        log.info(
            "OPC-UA UP  pump=%s  endpoint=%s  ns=%d",
            self.pump_label, endpoint, self._ns_idx,
        )

    async def stop(self) -> None:
        """Graceful shutdown."""
        self._running = False
        if self._server is not None:
            await self._server.stop()
            log.info("OPC-UA DOWN  pump=%s", self.pump_label)

    # ──────────────────────────────────────────────────────────────────────────
    # build_address_space  (private, called once from start())
    # ──────────────────────────────────────────────────────────────────────────

    async def _build_address_space(self) -> None:
        """
        Build the exact node tree defined in pump_config:

            Objects → PumpStation (Folder)
                    → Pump<N>     (Object)
                        → VibrationRadial     (Float)
                        → VibrationTangential (Float)
                        → VibrationAxial      (Float)
                        → Temperature         (Float)
                        → RPM                 (Float)
                        → Timestamp           (DateTime)

        Nodes are stored in self._nodes keyed by (pump_id, param_key).
        The Timestamp node is keyed as (pump_id, "timestamp").
        """
        objects_root = self._server.nodes.objects

        # Objects/PumpStation  (Folder)
        pump_station = await objects_root.add_folder(
            self._ns_idx, OPC_ROOT_OBJECT
        )

        # Objects/PumpStation/Pump<N>  (Object)
        pump_obj = await pump_station.add_object(
            self._ns_idx, self.pump_label
        )

        # The 5 Float variable nodes (ordered by PARAMS)
        for param_key in PARAMS:
            node_name = OPC_NODE_NAMES[param_key]
            var = await pump_obj.add_variable(
                self._ns_idx,
                node_name,
                float(0),
                varianttype=ua.VariantType.Float,
            )
            await var.set_writable()
            self._nodes[(self.pump_id, param_key)] = var
            log.debug("  node: %s/%s  key=(%s, %s)", self.pump_label, node_name, self.pump_id, param_key)

        # The Timestamp DateTime node
        ts_var = await pump_obj.add_variable(
            self._ns_idx,
            OPC_TIMESTAMP_NODE,
            ua.DateTime.now(),
            varianttype=ua.VariantType.DateTime,
        )
        await ts_var.set_writable()
        self._nodes[(self.pump_id, "timestamp")] = ts_var

        log.info(
            "Address space built: %d nodes for %s",
            len(self._nodes), self.pump_label,
        )

    # ──────────────────────────────────────────────────────────────────────────
    # update_nodes  (public — also called directly from tests)
    # ──────────────────────────────────────────────────────────────────────────

    async def update_nodes(self, reading: dict) -> None:
        """
        Write one compute_reading() output dict to the OPC-UA address space.

        compute_reading() returns:
            {
              "vibration_radial":     float,
              "vibration_tangential": float,
              "vibration_axial":      float,
              "temperature":          float,
              "rpm":                  float,
              "timestamp":            "2026-06-12T08:32:15.123456+00:00",  ← ISO-8601
            }

        Each key is looked up in self._nodes; unknown keys are skipped silently.
        Timestamp is parsed from the ISO-8601 string into a Python datetime.
        All floats are written as ua.VariantType.Float DataValues.
        """
        now_utc = datetime.now(tz=timezone.utc)

        for param_key, raw_value in reading.items():
            node = self._nodes.get((self.pump_id, param_key))
            if node is None:
                continue

            try:
                if param_key == "timestamp":
                    # compute_reading() emits ISO-8601 string; convert to datetime.
                    if isinstance(raw_value, str):
                        dt = datetime.fromisoformat(raw_value)
                    else:
                        dt = datetime.fromtimestamp(float(raw_value), tz=timezone.utc)
                    dv = ua.DataValue(
                        ua.Variant(dt, ua.VariantType.DateTime),
                        SourceTimestamp=dt,
                        ServerTimestamp=now_utc,
                    )
                else:
                    dv = ua.DataValue(
                        ua.Variant(float(raw_value), ua.VariantType.Float),
                        SourceTimestamp=now_utc,
                        ServerTimestamp=now_utc,
                    )
                await node.write_value(dv)

            except Exception as exc:       # noqa: BLE001
                log.warning(
                    "update_nodes: write failed  param=%s  pump=%s  err=%s",
                    param_key, self.pump_label, exc,
                )

    # ──────────────────────────────────────────────────────────────────────────
    # emit_loop  (public — run inside asyncio.gather() from main.py)
    # ──────────────────────────────────────────────────────────────────────────

    async def emit_loop(self, fault_state: Optional[FaultState]) -> None:
        """
        Async coroutine — runs forever until self._running is False.

        Each tick:
          1.  elapsed  = fault_state.elapsed_s()         (0 when no fault)
          2.  reading  = compute_reading(pump_id, fault_state, t=elapsed)
          3.  await update_nodes(reading)
          4.  period   = FLOOD_PERIOD_S if fault_state.flood else NORMAL_PERIOD_S
          5.  await asyncio.sleep(period)

        Rate logic:
          • Normal / any non-flood fault:  1 Hz  (NORMAL_PERIOD_S = 1.0 s)
          • Flood mode:                   10 Hz  (FLOOD_PERIOD_S  = 0.1 s)
          The flood flag is written to fault_state.flood by Person C's inject
          endpoint; B reads it here and never sets it.

        fault_state may be None (unit tests only) → always 1 Hz, normal values.
        Errors are logged but the loop is never allowed to die silently.
        """
        log.info("emit_loop START  pump=%s", self.pump_id)

        while self._running:
            try:
                elapsed = fault_state.elapsed_s() if fault_state is not None else 0.0
                reading = compute_reading(self.pump_id, fault_state, t=elapsed)
                await self.update_nodes(reading)

                # Flood mode → 10 Hz; everything else → 1 Hz.
                is_flood = (fault_state is not None and fault_state.flood)
                period = FLOOD_PERIOD_S if is_flood else NORMAL_PERIOD_S
                await asyncio.sleep(period)

            except asyncio.CancelledError:
                log.info("emit_loop CANCELLED  pump=%s", self.pump_id)
                break
            except Exception as exc:       # noqa: BLE001
                log.error(
                    "emit_loop ERROR  pump=%s  err=%s",
                    self.pump_id, exc, exc_info=True,
                )
                await asyncio.sleep(1.0)   # back-off; never die silently

        log.info("emit_loop STOP  pump=%s", self.pump_id)

    # ──────────────────────────────────────────────────────────────────────────
    # Convenience accessors (used by tests)
    # ──────────────────────────────────────────────────────────────────────────

    def get_node(self, param_key: str):
        """Return the asyncua node handle for a param_key, or None."""
        return self._nodes.get((self.pump_id, param_key))

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def node_count(self) -> int:
        """Total number of OPC-UA variable nodes created."""
        return len(self._nodes)
