import json
import pytest
from unittest.mock import AsyncMock, patch

from fastapi import WebSocketDisconnect
from routes import websocket as routes


@pytest.mark.asyncio
async def test_free_cadence_preserves_immediate_connection_and_refresh():
    socket = AsyncMock()
    socket.receive_text.side_effect = ['refresh', WebSocketDisconnect()]
    timeouts = []

    async def receive(awaitable, timeout):
        timeouts.append(timeout)
        return await awaitable

    with patch.object(routes.asyncio, 'wait_for', receive):
        await routes.health_websocket(socket)
    socket.accept.assert_awaited_once()
    assert len(socket.send_text.await_args_list) == 2
    assert all(json.loads(call.args[0])['type'] == 'health_update' for call in socket.send_text.await_args_list)
    assert timeouts == [float(routes.WEBSOCKET_INTERVAL)] * 2
    assert socket not in routes.connected_clients
