// state.js — owns all cue light state. Nothing else writes channels directly.

const VALID_STATES = new Set(['clear', 'standby', 'go']);
const DEFAULT_CHANNEL_COUNT = 8;
const DEFAULT_CHANNEL_PREFIX = 'Channel';

// channels is the single source of truth for all cue light state.
let channels = [];

/**
 * Initialize state from a list of channel names.
 * Called once at startup with names from config.json (or defaults).
 */
function init(names) {
  const resolvedNames = (Array.isArray(names) && names.length > 0)
    ? names
    : Array.from({ length: DEFAULT_CHANNEL_COUNT }, (_, i) => `${DEFAULT_CHANNEL_PREFIX} ${i + 1}`);

  channels = resolvedNames.map((name, id) => ({ id, name, state: 'clear', acked: false }));
}

/**
 * Returns a shallow copy of the full channel list so callers can't mutate state directly.
 */
function getAll() {
  return channels.map(ch => ({ ...ch }));
}

/**
 * Returns a single channel by id, or null if the id is out of range.
 */
function getChannel(id) {
  const ch = channels[id];
  return ch ? { ...ch } : null;
}

/**
 * Sets a single channel's state. Returns the updated channel, or null if id/action is invalid.
 * Validation is intentionally strict — callers should handle null as a 400 response.
 */
function setCue(id, action) {
  if (!Number.isInteger(id) || id < 0 || id >= channels.length) {
    return null;
  }
  if (!VALID_STATES.has(action)) {
    return null;
  }
  // Any cue change resets ack — a new standby requires a fresh acknowledgement.
  channels[id] = { ...channels[id], state: action, acked: false };
  return { ...channels[id] };
}

/**
 * Resets every channel to 'clear' and clears all acks.
 */
function clearAll() {
  channels = channels.map(ch => ({ ...ch, state: 'clear', acked: false }));
  return getAll();
}

/**
 * Sets a specific action on a list of channel ids in one pass, then returns the full state.
 * Invalid ids are skipped silently — the caller validates before calling.
 */
function setCueBatch(ids, action) {
  ids.forEach((id) => {
    if (Number.isInteger(id) && id >= 0 && id < channels.length) {
      channels[id] = { ...channels[id], state: action, acked: false };
    }
  });
  return getAll();
}

/**
 * Replaces the entire channel list with new names, resetting all state to clear.
 * Called when the operator saves a new configuration via the console.
 * All connected phones will be notified via WebSocket broadcast by the caller.
 */
function resetWithNames(names) {
  channels = names.map((name, id) => ({ id, name, state: 'clear', acked: false }));
  return getAll();
}

/**
 * Marks a channel as acknowledged by the performer.
 * Only meaningful when the channel is in 'standby' — but we don't enforce that here;
 * the API layer decides whether to accept the request.
 * Returns the updated channel, or null if id is out of range.
 */
function setAck(id) {
  if (!Number.isInteger(id) || id < 0 || id >= channels.length) {
    return null;
  }
  channels[id] = { ...channels[id], acked: true };
  return { ...channels[id] };
}

/**
 * Exposes the set of valid state strings so api.js can validate without importing the Set.
 */
function isValidAction(action) {
  return VALID_STATES.has(action);
}

/**
 * Returns the total number of configured channels.
 */
function channelCount() {
  return channels.length;
}

module.exports = { init, getAll, getChannel, setCue, setCueBatch, clearAll, setAck, resetWithNames, isValidAction, channelCount };
