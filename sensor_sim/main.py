"""
main.py — Person B's wiring layer.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Instantiates the ONE shared FaultState, wires it into:
  • OpcUaServer.emit_loop()  (B)  — reads FaultState, publishes to OPC-UA
  • create_inject_app()      (C)  — writes FaultState via HTTP POST /inject
Then runs everything concurrently via asyncio.gather().

Environment variables (set by docker-compose per container):
  PUMP_ID    = pump1 | pump2 | pump3     (default: pump1)
  OPC_PORT   = 4840 | 4841 | 4842       (overrides pump_config default)
  HTTP_PORT  = 8080 | 8081 | 8082       (overrides pump_config default)
  LOG_LEVEL  = DEBUG | INFO | WARNING   (default: INFO)
"""

import asyncio
import logging
import os
import signal
import sys

import uvicorn

# ── Person A: pure math layer ─────────────────────────────────────────────────
from fault_engine import FaultState

# ── Person A: shared config (port defaults from pump_config) ─────────────────
from pump_config import OPC_PUMP_OBJECT, PUMP_IDS

# ── Person B: OPC-UA server ───────────────────────────────────────────────────
from opc_server import OpcUaServer

# ── Person C: FastAPI inject app factory ─────────────────────────────────────
from inject_server import create_inject_app

# ═══════════════════════════════════════════════════════════════════════════════
# Logging
# ═══════════════════════════════════════════════════════════════════════════════
LOG_LEVEL: str = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s  [%(levelname)-8s]  %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# Config from env vars
# ═══════════════════════════════════════════════════════════════════════════════
PUMP_ID: str = os.environ.get("PUMP_ID", "pump1").lower()

if PUMP_ID not in PUMP_IDS:
    log.critical("Invalid PUMP_ID=%r. Must be one of %s", PUMP_ID, PUMP_IDS)
    sys.exit(1)

# Default OPC ports: pump1→4840, pump2→4841, pump3→4842
_DEFAULT_OPC_PORTS  = {"pump1": 4840, "pump2": 4841, "pump3": 4842}
_DEFAULT_HTTP_PORTS = {"pump1": 8080, "pump2": 8081, "pump3": 8082}

OPC_PORT:  int = int(os.environ.get("OPC_PORT",  _DEFAULT_OPC_PORTS[PUMP_ID]))
HTTP_PORT: int = int(os.environ.get("HTTP_PORT", _DEFAULT_HTTP_PORTS[PUMP_ID]))

# ═══════════════════════════════════════════════════════════════════════════════
# Shutdown coordination
# ═══════════════════════════════════════════════════════════════════════════════
_shutdown_event: asyncio.Event = asyncio.Event()


def _request_shutdown(*_) -> None:
    log.info("Shutdown signal received.")
    _shutdown_event.set()


async def _wait_for_shutdown() -> None:
    """Block until SIGINT/SIGTERM is received."""
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _request_shutdown)
        except (NotImplementedError, OSError):
            pass   # Windows does not support add_signal_handler for SIGTERM
    await _shutdown_event.wait()


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

async def main() -> None:
    log.info(
        "EdgeMind sensor-sim STARTING  pump=%s  opc_port=%d  http_port=%d",
        PUMP_ID, OPC_PORT, HTTP_PORT,
    )

    # ── 1. ONE shared FaultState — created here, passed by reference everywhere
    #       A defines the class; B instantiates it; C mutates it via HTTP;
    #       B's emit_loop reads it every tick.
    fault_state = FaultState()

    # ── 2. OPC-UA server (B)
    opc_server = OpcUaServer(pump_id=PUMP_ID, opc_port=OPC_PORT)

    # ── 3. FastAPI inject app (C) — receives the shared FaultState reference
    inject_app = create_inject_app(fault_state)

    # ── 4. uvicorn — runs on the existing asyncio event loop (loop="none")
    uv_config = uvicorn.Config(
        app=inject_app,
        host="0.0.0.0",
        port=HTTP_PORT,
        log_level=LOG_LEVEL.lower(),
        loop="none",          # do NOT create a new event loop
        access_log=True,
    )
    uv_server = uvicorn.Server(uv_config)

    # ── 5. Start OPC-UA (builds address space, binds TCP port)
    await opc_server.start()

    # ── 6. Run all three coroutines concurrently
    try:
        await asyncio.gather(
            opc_server.emit_loop(fault_state),   # B: tick → compute → publish
            uv_server.serve(),                    # C: POST /inject, GET /status
            _wait_for_shutdown(),                 # signal handler
        )
    except asyncio.CancelledError:
        log.info("Main gather cancelled.")
    except Exception as exc:
        log.critical("Fatal error: %s", exc, exc_info=True)
    finally:
        await opc_server.stop()
        log.info("EdgeMind sensor-sim STOPPED.")


# ═══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Interrupted.")
        sys.exit(0)
