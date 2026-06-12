"""
inject_server.py — STUB for Person B's integration testing.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is a MINIMAL STUB so Person B's main.py and test_server.py can run
before Person C delivers the real inject_server.py.

The REAL inject_server.py (Person C) will replace this file entirely.
This stub implements the agreed Phase-0 contract:
  POST /inject  → {"ok": true, "active_fault": "<mode>"}
  GET  /status  → {"pump_id", "active_fault", "elapsed_s", "readings"}
  GET  /health  → {"status": "ok", "pump_id": "..."}

DO NOT modify this file. Person C owns the real implementation.
"""

import os
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel

from fault_engine import FaultState, compute_reading
from pump_config import INJECT_DEFAULT_DURATION_S, valid_inject_modes

PUMP_ID: str = os.environ.get("PUMP_ID", "pump1").lower()


class InjectRequest(BaseModel):
    mode: str
    duration_s: int = INJECT_DEFAULT_DURATION_S


def create_inject_app(fault_state: FaultState) -> FastAPI:
    """
    Return a FastAPI app whose routes share the given FaultState.
    Person B calls this from main.py with the ONE shared FaultState instance.
    """
    app = FastAPI(
        title="EdgeMind Inject Server (stub)",
        description=f"Fault injection stub for {PUMP_ID}",
        version="0.1.0-stub",
    )

    @app.post("/inject")
    async def handle_inject(req: InjectRequest):
        if req.mode == "clear":
            fault_state.clear()
        else:
            fault_state.activate(req.mode, req.duration_s)
        return {"ok": True, "active_fault": fault_state.mode}

    @app.get("/status")
    async def status():
        elapsed = fault_state.elapsed_s()
        reading = compute_reading(PUMP_ID, fault_state, t=elapsed)
        return {
            "pump_id":      PUMP_ID,
            "active_fault": fault_state.mode,
            "elapsed_s":    round(elapsed, 2),
            "readings":     reading,
        }

    @app.get("/health")
    async def health():
        return {"status": "ok", "pump_id": PUMP_ID}

    return app
