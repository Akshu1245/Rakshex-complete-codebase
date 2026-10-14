"""
WebSocket Routes - Real-time health monitoring via WebSocket.

Pushes health snapshots at the configured interval (60 seconds in the free resource profile).
"""
import asyncio
import json
import logging
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services import health_monitor
from services.resource_config import WEBSOCKET_INTERVAL

logger = logging.getLogger(__name__)

router = APIRouter()

# Track connected WebSocket clients
connected_clients: Set[WebSocket] = set()


@router.websocket("/ws/health")
async def health_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time health updates.
    
    Sends health snapshots periodically, and immediately on manual refresh.
    """
    await websocket.accept()
    connected_clients.add(websocket)
    logger.info(f"WebSocket client connected. Total: {len(connected_clients)}")
    
    try:
        # Send initial health data immediately
        await _send_health_data(websocket)
        
        # Keep connection alive and push updates
        while True:
            # Avoid retransmitting an unchanged snapshot six times per minute.
            try:
                # Use wait_for to allow periodic pushes
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=float(WEBSOCKET_INTERVAL))
                
                # Client can request immediate refresh
                if msg == "refresh":
                    await _send_health_data(websocket)
                    
            except asyncio.TimeoutError:
                # No message from client - push update
                await _send_health_data(websocket)
                
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {type(e).__name__}")
    finally:
        connected_clients.discard(websocket)
        logger.info(f"WebSocket clients remaining: {len(connected_clients)}")


async def _send_health_data(websocket: WebSocket):
    """Send current health data to a single WebSocket client."""
    try:
        payload = {
            "type": "health_update",
            "timestamp": health_monitor._last_run or "",
            "apis": {}
        }
        
        for name, info in health_monitor.health_data.items():
            payload["apis"][name] = {
                "status": info.get("status", "unknown"),
                "latency_ms": info.get("latency_ms", 0),
                "status_code": info.get("status_code"),
                "last_checked": info.get("last_checked", ""),
            }
        
        await websocket.send_text(json.dumps(payload))
    except Exception as e:
        logger.error(f"Failed to send health data: {e}")


async def broadcast_health_update():
    """Broadcast health data to all connected WebSocket clients."""
    if not connected_clients:
        return
    
    disconnected = set()
    for client in connected_clients:
        try:
            await _send_health_data(client)
        except Exception:
            disconnected.add(client)
    
    # Clean up disconnected clients
    for client in disconnected:
        connected_clients.discard(client)
