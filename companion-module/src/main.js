// main.js — entry point for the Standby Companion module.
// Connects to the Standby server via WebSocket for live state updates,
// and sends cue commands via HTTP when Stream Deck buttons are pressed.

import { InstanceBase, InstanceStatus, runEntrypoint } from '@companion-module/base';
import WebSocket from 'ws';
import { getActionDefinitions } from './actions.js';
import { getFeedbackDefinitions } from './feedbacks.js';
import { getVariableDefinitions, buildVariableValues } from './variables.js';
import { getPresetDefinitions } from './presets.js';

const RECONNECT_DELAY_MS = 3000;

class StandbyInstance extends InstanceBase {
  constructor(internal) {
    super(internal);
    this.state = { channels: [] };
    this.socket = null;
    this.reconnectTimer = null;
    // Tracked so we only re-register definitions when the channel list actually changes.
    this.registeredChannelCount = 0;
  }

  async init(config) {
    this.config = config;
    // Register minimal definitions immediately so Companion has something while connecting.
    this.registerDefinitions([]);
    this.connect();
  }

  async destroy() {
    clearTimeout(this.reconnectTimer);
    this.closeSocket();
  }

  async configUpdated(config) {
    this.config = config;
    clearTimeout(this.reconnectTimer);
    this.closeSocket();
    this.connect();
  }

  getConfigFields() {
    return [
      {
        type: 'textinput',
        id: 'host',
        label: 'Standby Server Host / IP',
        default: '127.0.0.1',
        width: 8,
      },
      {
        type: 'number',
        id: 'port',
        label: 'Port',
        default: 3000,
        min: 1,
        max: 65535,
        width: 4,
      },
    ];
  }

  // ── Definition registration ────────────────────────────────────────────────

  // Re-registers all Companion definitions based on the current channel list.
  // Called on first connect and whenever the operator changes the channel config.
  registerDefinitions(channels) {
    const count = channels.length;
    this.setVariableDefinitions(getVariableDefinitions(channels));
    this.setActionDefinitions(getActionDefinitions(this, count));
    this.setFeedbackDefinitions(getFeedbackDefinitions(this, count));
    this.setPresetDefinitions(getPresetDefinitions(channels));
    this.registeredChannelCount = count;
  }

  // ── WebSocket connection ───────────────────────────────────────────────────

  connect() {
    const { host, port } = this.config;
    if (!host || !port) {
      this.updateStatus(InstanceStatus.BadConfig, 'Host and port are required');
      return;
    }

    this.updateStatus(InstanceStatus.Connecting);
    const url = `ws://${host}:${port}`;

    let socket;
    try {
      socket = new WebSocket(url);
    } catch (err) {
      this.log('error', `Failed to open WebSocket to ${url}: ${err.message}`);
      this.updateStatus(InstanceStatus.ConnectionFailure, err.message);
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;

    socket.on('open', () => {
      this.log('info', `Connected to Standby server at ${url}`);
      this.updateStatus(InstanceStatus.Ok);
    });

    socket.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch (err) {
        this.log('warn', `Received invalid JSON from server: ${err.message}`);
        return;
      }

      if (msg.type === 'state' && Array.isArray(msg.channels)) {
        this.state.channels = msg.channels;
        this.setVariableValues(buildVariableValues(msg.channels));

        // Re-register all definitions if the channel count changed.
        // This covers both initial connect and live reconfiguration from the console.
        if (msg.channels.length !== this.registeredChannelCount) {
          this.log('info', `Channel count changed to ${msg.channels.length} — updating definitions`);
          this.registerDefinitions(msg.channels);
        }

        this.checkFeedbacks('channel_state', 'channel_acked');
      }
    });

    socket.on('close', () => {
      this.log('warn', 'WebSocket connection closed — will reconnect');
      this.updateStatus(InstanceStatus.Connecting, 'Reconnecting…');
      this.scheduleReconnect();
    });

    socket.on('error', (err) => {
      // 'error' is always followed by 'close', which handles reconnect.
      this.log('error', `WebSocket error: ${err.message}`);
      this.updateStatus(InstanceStatus.ConnectionFailure, err.message);
    });
  }

  closeSocket() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = null;
    }
  }

  scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
  }

  // ── HTTP helpers called by action callbacks ────────────────────────────────

  async sendCue(channel, state) {
    const { host, port } = this.config;
    try {
      const res = await fetch(`http://${host}:${port}/cue/${channel}/${state}`, { method: 'POST' });
      if (!res.ok) { this.log('warn', `Cue request failed: HTTP ${res.status}`); }
    } catch (err) {
      this.log('error', `Cue request error: ${err.message}`);
    }
  }

  async sendBatchCue(ids, state) {
    const { host, port } = this.config;
    try {
      const res = await fetch(`http://${host}:${port}/cue/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action: state }),
      });
      if (!res.ok) { this.log('warn', `Batch cue failed: HTTP ${res.status}`); }
    } catch (err) {
      this.log('error', `Batch cue error: ${err.message}`);
    }
  }

  async sendClearAll() {
    const { host, port } = this.config;
    try {
      const res = await fetch(`http://${host}:${port}/all/clear`, { method: 'POST' });
      if (!res.ok) { this.log('warn', `Clear-all request failed: HTTP ${res.status}`); }
    } catch (err) {
      this.log('error', `Clear-all request error: ${err.message}`);
    }
  }
}

runEntrypoint(StandbyInstance, []);
