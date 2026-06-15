"""
main.py — edgemind-server runtime.

FastAPI + WebSocket server that wires:
  - CorrelationFilter (reads Redis findings)
  - Orchestrator (Qwen3:8b via Ollama)
  - DependencyGraph (K8s topology)

REST endpoints:
  GET  /health              liveness
  GET  /api/alerts          recent AI analyses (last 50)
  GET  /api/dependency-graph  current pod topology
  GET  /api/findings        recent raw findings from Redis
  GET  /api/agent-status    heartbeat status of 4 agents

WebSocket:
  WS   /ws                  streams findings + AI analyses to dashboard
"""

import asyncio
import json
import logging
import os
import sys
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

import redis.asyncio as aioredis
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from kubernetes import client as k8s_client, config as k8s_config

from edgemind_server.correlation_filter import CorrelationFilter, CorrelatedSignalBundle
from edgemind_server.dependency_graph import DependencyGraph
from edgemind_server.orchestrator import Orchestrator

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)-8s] %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("edgemind.server")

HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8080"))
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis-svc.monitoring.svc.cluster.local:6379")

# In-memory stores
_recent_alerts: deque = deque(maxlen=50)
_recent_findings: deque = deque(maxlen=200)
_ws_clients: Set[WebSocket] = set()

app = FastAPI(title="EdgeMind Server", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared components (initialized at startup)
_redis: Optional[aioredis.Redis] = None
_graph: Optional[DependencyGraph] = None
_orchestrator: Optional[Orchestrator] = None
_correlation_filter: Optional[CorrelationFilter] = None
_executor = ThreadPoolExecutor(max_workers=1)  # One orchestrator call at a time

# Track IDs of findings already relayed (to avoid duplicates)
_relayed_ids: set = set()


async def _broadcast_to_ws(message: Dict[str, Any]) -> None:
    """Send a message to all connected WebSocket clients."""
    if not _ws_clients:
        return
    payload = json.dumps(message, default=str)
    dead = set()
    for ws in _ws_clients:
        try:
            await ws.send_text(payload)
        except Exception:
            dead.add(ws)
    _ws_clients.difference_update(dead)


async def _on_correlated_bundle(bundle: CorrelatedSignalBundle) -> None:
    """Called by correlation filter when a trigger fires."""
    log.info("Orchestrator triggered: %s", bundle.trigger_reason)

    # Broadcast the bundle to dashboard immediately (before LLM responds)
    await _broadcast_to_ws({
        "type": "correlation_trigger",
        "data": bundle.to_dict(),
    })

    # Run orchestrator in thread pool (blocking LLM call)
    loop = asyncio.get_running_loop()
    try:
        result = await loop.run_in_executor(
            _executor,
            _orchestrator.analyze,
            bundle,
        )
        result_dict = result.to_dict()
        result_dict["bundle"] = bundle.to_dict()
        _recent_alerts.appendleft(result_dict)

        # Broadcast AI result to dashboard
        await _broadcast_to_ws({
            "type": "ai_analysis",
            "data": result_dict,
        })
        log.info(
            "Analysis complete: root_cause=%s confidence=%.2f duration=%.1fs",
            result.root_cause_pod, result.confidence, result.analysis_duration_s,
        )
    except Exception as e:
        log.error("Orchestrator failed: %s", e, exc_info=True)


async def _finding_relay_loop() -> None:
    last_seen = 0
    while True:
        try:
            # Non-destructive: read without consuming
            findings = await _redis.lrange("edgemind:findings", 0, 9)
            for payload in findings:
                finding = json.loads(payload)
                fid = finding.get("finding_id", "")
                if fid and fid not in _relayed_ids:
                    _relayed_ids.add(fid)
                    _recent_findings.appendleft(finding)
                    await _broadcast_to_ws({"type": "finding", "data": finding})
        except asyncio.CancelledError:
            raise
        except Exception as e:
            log.warning("Finding relay error: %s", e)
        await asyncio.sleep(2)


# ── REST endpoints ────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return JSONResponse({"ok": True, "service": "edgemind-server"})

@app.get("/api/alerts")
async def get_alerts(limit: int = 20):
    return JSONResponse({
        "alerts": list(_recent_alerts)[:limit],
        "count": len(_recent_alerts),
    })

@app.get("/api/findings")
async def get_findings(limit: int = 50):
    return JSONResponse({
        "findings": list(_recent_findings)[:limit],
        "count": len(_recent_findings),
    })

@app.get("/api/dependency-graph")
async def get_dependency_graph():
    return JSONResponse(_graph.to_json() if _graph else {})

@app.get("/api/agent-status")
async def get_agent_status():
    """Check heartbeats of all 4 agents."""
    agents = ["cpu", "memory", "storage", "network_log"]
    status = {}
    for agent in agents:
        key = f"edgemind:heartbeat:{agent}"
        val = await _redis.get(key)
        status[agent] = {
            "alive": val is not None,
            "last_heartbeat": val,
        }
    return JSONResponse(status)

@app.delete("/api/alerts")
async def clear_alerts():
    _recent_alerts.clear()
    if _correlation_filter:
        _correlation_filter.reset_cooldown()
    return JSONResponse({"cleared": True})


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    _ws_clients.add(ws)
    log.info("WebSocket client connected (%d total)", len(_ws_clients))
    try:
        # Send current state on connect
        await ws.send_text(json.dumps({
            "type": "init",
            "data": {
                "recent_findings": list(_recent_findings)[:20],
                "recent_alerts": list(_recent_alerts)[:5],
                "dependency_graph": _graph.to_json() if _graph else {},
            }
        }, default=str))
        # Keep alive
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        _ws_clients.discard(ws)
        log.info("WebSocket client disconnected (%d total)", len(_ws_clients))


# ── Startup / shutdown ────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    global _redis, _graph, _orchestrator

    # Redis
    _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    await _redis.ping()
    log.info("Redis connected")

    # Kubernetes
    try:
        k8s_config.load_incluster_config()
    except Exception:
        k8s_config.load_kube_config()
    k8s_v1 = k8s_client.CoreV1Api()

    # Dependency graph
    _graph = DependencyGraph(k8s_v1)
    _graph.refresh()

    # Orchestrator
    _orchestrator = Orchestrator(_graph)

    # Start background tasks
    asyncio.create_task(_run_correlation_filter())
    asyncio.create_task(_finding_relay_loop())

    log.info("edgemind-server ready on %s:%d", HOST, PORT)


async def _run_correlation_filter():
    """Run the correlation filter as a background task."""
    global _correlation_filter
    _correlation_filter = CorrelationFilter(
        redis=_redis,
        on_trigger=_on_correlated_bundle,
    )
    await _correlation_filter.run()


@app.on_event("shutdown")
async def shutdown():
    if _orchestrator:
        _orchestrator.close()
    if _redis:
        await _redis.aclose()


if __name__ == "__main__":
    uvicorn.run("edgemind_server.main:app", host=HOST, port=PORT, log_level=LOG_LEVEL.lower())
