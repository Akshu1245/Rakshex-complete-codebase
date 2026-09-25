/**
 * Native WebSocket upgrade — replaces socket.io (apps/api/websocket.ts).
 *
 * M0 scope: stateless per-connection stream. The client opens
 * GET /v1/stream/decisions?workspaceId=1 and receives JSON decision events for
 * evaluates that happen inside THIS isolate. Cross-isolate fan-out (the thing
 * socket.io's adapter did across Node processes) needs a Durable Object
 * hibernation broker — documented as the follow-up in PORT_NOTES.md, not built
 * here (YAGNI: the evaluate slice works without it).
 */
import type { Env } from "../env";

export function isUpgradeRequest(req: Request): boolean {
  return req.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

/**
 * Accepts the upgrade and returns the 101 response. The caller owns the
 * returned server socket (attach message handlers as needed).
 */
export function acceptWs(req: Request): { response: Response; socket: WebSocket } {
  if (!isUpgradeRequest(req)) {
    throw new Error("Not a WebSocket upgrade request");
  }
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  return { response: new Response(null, { status: 101, webSocket: client }), socket: server };
}

export interface DecisionEvent {
  type: "decision";
  workspaceId: number;
  requestId: string;
  decision: string;
  effectiveDecision: string;
  receiptId: number;
  entryHash: string;
  at: string;
}

export function sendDecisionEvent(socket: WebSocket, event: DecisionEvent): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(event));
  }
}

export function handleDecisionStream(req: Request, _env: Env, workspaceId: number): Response {
  const { response, socket } = acceptWs(req);
  socket.send(JSON.stringify({ type: "hello", workspaceId, at: new Date().toISOString() }));
  socket.addEventListener("message", (evt) => {
    try {
      const msg = JSON.parse(String(evt.data));
      if (msg?.type === "ping") socket.send(JSON.stringify({ type: "pong" }));
    } catch {
      // ignore malformed frames
    }
  });
  return response;
}
