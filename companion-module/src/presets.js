// presets.js — pre-built buttons generated from the live channel list.
// Called with the actual channel array so preset names match server config.

import { combineRgb } from '@companion-module/base';

const BASE_STYLE = {
  size: 'auto',
  color: combineRgb(255, 255, 255),
  bgcolor: combineRgb(30, 30, 30),
};

export function getPresetDefinitions(channels) {
  const presets = {};

  channels.forEach((ch) => {
    const category = `CH ${ch.id} — ${ch.name}`;
    const stateFeedback = { feedbackId: 'channel_state', options: { channel: ch.id } };

    presets[`standby_${ch.id}`] = {
      type: 'button',
      category,
      name: `Standby — ${ch.name}`,
      style: { ...BASE_STYLE, text: `${ch.name}\\nSTANDBY` },
      feedbacks: [stateFeedback],
      steps: [{ down: [{ actionId: 'set_cue', options: { channel: ch.id, state: 'standby' } }], up: [] }],
    };

    presets[`go_${ch.id}`] = {
      type: 'button',
      category,
      name: `Go — ${ch.name}`,
      style: { ...BASE_STYLE, text: `${ch.name}\\nGO` },
      feedbacks: [stateFeedback],
      steps: [{ down: [{ actionId: 'set_cue', options: { channel: ch.id, state: 'go' } }], up: [] }],
    };

    presets[`clear_${ch.id}`] = {
      type: 'button',
      category,
      name: `Clear — ${ch.name}`,
      style: { ...BASE_STYLE, text: `${ch.name}\\nCLEAR` },
      feedbacks: [stateFeedback],
      steps: [{ down: [{ actionId: 'set_cue', options: { channel: ch.id, state: 'clear' } }], up: [] }],
    };

    presets[`acked_${ch.id}`] = {
      type: 'button',
      category,
      name: `Ack Indicator — ${ch.name}`,
      style: { ...BASE_STYLE, text: `${ch.name}\\nACKED` },
      feedbacks: [{ feedbackId: 'channel_acked', options: { channel: ch.id } }],
      steps: [{ down: [], up: [] }],
    };
  });

  presets['clear_all'] = {
    type: 'button',
    category: 'Global',
    name: 'Clear All',
    style: { ...BASE_STYLE, text: 'CLEAR\\nALL', bgcolor: combineRgb(180, 20, 20) },
    feedbacks: [],
    steps: [{ down: [{ actionId: 'clear_all', options: {} }], up: [] }],
  };

  return presets;
}
