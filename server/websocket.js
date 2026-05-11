// websocket.js — manages WebSocket connections and state broadcasts.
// Shares the same HTTP server as Express so both run on a single port.

const { WebSocketServer, WebSocket } = require('ws');
const state = require('./state');
const logger = require('./logger');

let wss = null;

/**
 * Attach a WebSocketServer to an existing http.Server instance.
 * Using 'upgrade' event sharing means we don't need a second port.
 */
function createWebSocketServer(httpServer) {
  wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (socket, req) => {
    const clientIp = req.socket.remoteAddress;
    logger.info(`WebSocket client connected: ${clientIp}`);

    // Send the full current state immediately so the new client doesn't wait for a change event.
    sendToSocket(socket, { type: 'state', channels: state.getAll() });

    socket.on('close', () => {
      logger.info(`WebSocket client disconnected: ${clientIp}`);
    });

    socket.on('error', (err) => {
      // Log but don't crash — a single bad client shouldn't bring down the server.
      logger.error(`WebSocket error from ${clientIp}:`, err.message);
    });
  });

  wss.on('error', (err) => {
    logger.error('WebSocketServer error:', err.message);
  });

  logger.info('WebSocket server attached to HTTP server');
}

/**
 * Serialize and send a message to a single socket.
 * Guards against sending to a socket that isn't open.
 */
function sendToSocket(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }
  try {
    socket.send(JSON.stringify(payload));
  } catch (err) {
    logger.error('Failed to send to socket:', err.message);
  }
}

/**
 * Broadcast a payload to every currently connected client.
 * Called by api.js (via the handler registered in index.js) after every state mutation.
 * Iterates wss.clients — the ws library maintains this Set automatically.
 */
function broadcast(payload) {
  if (!wss) {
    logger.warn('broadcast called before WebSocket server was initialized');
    return;
  }
  const message = JSON.stringify(payload);
  let sent = 0;
  // wss.clients is a live Set; iterate a snapshot in case a client disconnects mid-loop.
  for (const socket of wss.clients) {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(message);
        sent++;
      } catch (err) {
        logger.error('Failed to broadcast to a client:', err.message);
      }
    }
  }
  if (sent === 0) {
    logger.warn('broadcast: no clients connected');
  }
}

module.exports = { createWebSocketServer, broadcast };
