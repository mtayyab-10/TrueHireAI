import { createServer } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { sessionSockets } from "./lib/ws.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (request, socket, head) => {
  const pathname = request.url ?? "";
  const match = /^\/ws\/interview\/([^/?#]+)/.exec(pathname);

  if (match) {
    const sessionId = match[1]!;
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, sessionId);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws: WebSocket, _req: unknown, sessionId: string) => {
  if (!sessionSockets.has(sessionId)) {
    sessionSockets.set(sessionId, new Set());
  }
  sessionSockets.get(sessionId)!.add(ws);

  logger.info({ sessionId }, "WebSocket client connected");

  ws.send(
    JSON.stringify({
      type: "connected",
      sessionId,
      message: "TrueHire AI live feed connected.",
    }),
  );

  ws.on("close", () => {
    sessionSockets.get(sessionId)?.delete(ws);
    if (sessionSockets.get(sessionId)?.size === 0) {
      sessionSockets.delete(sessionId);
    }
    logger.info({ sessionId }, "WebSocket client disconnected");
  });

  ws.on("error", (err) => {
    logger.error({ err, sessionId }, "WebSocket error");
  });
});

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
});

httpServer.on("error", (err) => {
  logger.error({ err }, "HTTP server error");
  process.exit(1);
});
