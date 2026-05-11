// config.js — reads and writes config.json. Only this file touches the disk for config.

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

const DEFAULTS = {
  channels: Array.from({ length: 8 }, (_, i) => `Channel ${i + 1}`),
  port: 3000,
};

function load() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      channels: (Array.isArray(parsed.channels) && parsed.channels.length > 0)
        ? parsed.channels
        : DEFAULTS.channels,
      port: Number.isInteger(parsed.port) ? parsed.port : DEFAULTS.port,
    };
  } catch (_err) {
    logger.warn('config.json not found or invalid — using defaults');
    return { ...DEFAULTS, channels: [...DEFAULTS.channels] };
  }
}

function save(channels, port) {
  try {
    const data = { channels, port };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
    return true;
  } catch (err) {
    logger.error('Failed to write config.json:', err.message);
    return false;
  }
}

module.exports = { load, save };
