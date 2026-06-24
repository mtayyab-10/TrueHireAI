import type { WebSocket } from "ws";

export const sessionSockets = new Map<string, Set<WebSocket>>();

export function broadcastToSession(sessionId: string, data: object): void {
  const sockets = sessionSockets.get(sessionId);
  if (!sockets || sockets.size === 0) return;

  const message = JSON.stringify(data);
  for (const ws of sockets) {
    if (ws.readyState === 1) {
      ws.send(message);
    }
  }
}
