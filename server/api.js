// api.js — Express router. Validates inputs and delegates state changes to state.js.
// Does NOT touch state directly; all mutations go through state module functions.

const express = require('express');
const state = require('./state');
const config = require('./config');
const logger = require('./logger');

const router = express.Router();

// onStateChange is injected by index.js so api.js has no knowledge of WebSocket internals.
let onStateChange = null;

function setStateChangeHandler(handler) {
  onStateChange = handler;
}

// Notify WebSocket layer of a state change if a handler is registered.
function notifyChange() {
  if (typeof onStateChange === 'function') {
    onStateChange(state.getAll());
  }
}

// GET /state — full snapshot of all channels
router.get('/state', (_req, res) => {
  res.json({ channels: state.getAll() });
});

// POST /cue/:id/:action — set a single channel's cue state
router.post('/cue/:id/:action', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const action = req.params.action;

  // Reject non-integer or out-of-range channel IDs before touching state
  if (Number.isNaN(id) || id < 0 || id >= state.channelCount()) {
    logger.warn(`Invalid channel id: ${req.params.id}`);
    return res.status(400).json({ ok: false, error: `Channel id must be 0–${state.channelCount() - 1}` });
  }

  if (!state.isValidAction(action)) {
    logger.warn(`Invalid action: ${action}`);
    return res.status(400).json({ ok: false, error: 'Action must be standby, go, or clear' });
  }

  const updated = state.setCue(id, action);
  if (!updated) {
    // Should never reach here given the checks above, but guard anyway
    return res.status(500).json({ ok: false, error: 'State update failed unexpectedly' });
  }

  notifyChange();
  return res.json({ ok: true, channel: updated });
});

// POST /ack/:id — performer acknowledges they've seen their standby cue
router.post('/ack/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id) || id < 0 || id >= state.channelCount()) {
    logger.warn(`Invalid channel id for ack: ${req.params.id}`);
    return res.status(400).json({ ok: false, error: `Channel id must be 0–${state.channelCount() - 1}` });
  }

  const updated = state.setAck(id);
  if (!updated) {
    return res.status(500).json({ ok: false, error: 'Ack failed unexpectedly' });
  }

  notifyChange();
  return res.json({ ok: true, channel: updated });
});

// POST /all/clear — reset every channel to clear
router.post('/all/clear', (_req, res) => {
  state.clearAll();
  notifyChange();
  res.json({ ok: true });
});

// POST /cue/batch — set multiple channels to the same state in one broadcast
router.post('/cue/batch', (req, res) => {
  const { ids, action } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ ok: false, error: 'ids must be a non-empty array' });
  }
  if (!state.isValidAction(action)) {
    return res.status(400).json({ ok: false, error: 'action must be standby, go, or clear' });
  }

  const parsed = ids.map(id => parseInt(id, 10));
  const invalid = parsed.filter(id => Number.isNaN(id) || id < 0 || id >= state.channelCount());
  if (invalid.length > 0) {
    return res.status(400).json({ ok: false, error: `Invalid channel ids: ${invalid.join(', ')}` });
  }

  state.setCueBatch(parsed, action);
  notifyChange();
  return res.json({ ok: true, channels: state.getAll() });
});

// GET /config — returns the current channel name list for the settings panel
router.get('/config', (_req, res) => {
  res.json({ channels: state.getAll().map(ch => ch.name) });
});

// POST /config/channels — replace channel list, reset all cue states, persist to disk
router.post('/config/channels', (req, res) => {
  const { channels } = req.body;

  if (!Array.isArray(channels) || channels.length === 0) {
    return res.status(400).json({ ok: false, error: 'channels must be a non-empty array of strings' });
  }

  const names = channels.map(n => String(n).trim()).filter(n => n.length > 0);
  if (names.length === 0) {
    return res.status(400).json({ ok: false, error: 'All channel names were empty after trimming' });
  }

  state.resetWithNames(names);

  // Persist so the new names survive a server restart. Port is unchanged.
  const existing = config.load();
  const saved = config.save(names, existing.port);
  if (!saved) {
    logger.warn('Channel list updated in memory but could not be written to config.json');
  }

  notifyChange();
  return res.json({ ok: true, channels: state.getAll() });
});

// GET /health — liveness check; includes uptime for diagnostics
router.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: Math.floor(process.uptime()) });
});

module.exports = { router, setStateChangeHandler };
