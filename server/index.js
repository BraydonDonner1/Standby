// index.js — entry point. Wires together Express, WebSocket, and state.

const http = require('http');
const path = require('path');
const express = require('express');
const state = require('./state');
const { router, setStateChangeHandler } = require('./api');
const { createWebSocketServer, broadcast } = require('./websocket');
const { load: loadConfig } = require('./config');
const { router: uploadsRouter, UPLOADS_DIR } = require('./uploads');
const logger = require('./logger');

const config = loadConfig();
const PORT = config.port;

// Initialize in-memory state with channel names from config
state.init(config.channels);
logger.info(`Initialized ${state.channelCount()} channels`);

const app = express();
app.use(express.json());

// Serve HTML files with no-cache headers so browsers always fetch fresh versions
const clientDir = path.join(__dirname, '..', 'client');
app.get(['/', '/index.html', '/console.html'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const file = req.path === '/' ? 'index.html' : req.path.slice(1);
  res.sendFile(path.join(clientDir, file));
});

// Serve remaining static client files (JS, CSS, images, etc.)
app.use(express.static(clientDir));
app.use('/uploads', express.static(UPLOADS_DIR));

// Mount API and upload routes
app.use('/', router);
app.use('/', uploadsRouter);

// Wire the WebSocket broadcast into the API layer so state changes push to all clients
setStateChangeHandler((channels) => {
  broadcast({ type: 'state', channels });
});

const server = http.createServer(app);
createWebSocketServer(server);

server.listen(PORT, () => {
  logger.info(`Standby server running on port ${PORT}`);
  logger.info(`Web client: http://localhost:${PORT}/`);
  logger.info(`Console:    http://localhost:${PORT}/console.html`);
  // Tell the Electron parent (if running) that we're up.
  if (process.send) { process.send({ type: 'ready', port: PORT }); }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use — another process may be running`);
    // Tell Electron so it can surface the error in the tray.
    if (process.send) { process.send({ type: 'error', code: 'EADDRINUSE', port: PORT }); }
    process.exit(1);
  }
});

// Graceful shutdown on SIGTERM/SIGINT
function shutdown(signal) {
  logger.info(`Received ${signal} — shutting down`);
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
