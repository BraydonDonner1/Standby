// feedbacks.js — feedback definitions. channelCount drives the valid range.
//
// channel_state (advanced): single feedback covering all visual states.
//   clear            → near-black
//   standby          → amber
//   standby + acked  → light green  ← performer tapped "I'm Ready"
//   go               → bright green
//
// channel_acked (boolean): standalone ack indicator for dedicated status buttons.

import { combineRgb } from '@companion-module/base';

const COLOR = {
  clear:        { bgcolor: combineRgb(30,  30,  30),  color: combineRgb(120, 120, 120) },
  standby:      { bgcolor: combineRgb(217, 119,  6),  color: combineRgb(255, 255, 255) },
  standbyAcked: { bgcolor: combineRgb(74,  222, 128), color: combineRgb(0,   0,   0)   },
  go:           { bgcolor: combineRgb(22,  163,  74), color: combineRgb(255, 255, 255) },
};

export function getFeedbackDefinitions(instance, channelCount) {
  const maxChannel = Math.max(0, channelCount - 1);

  const channelOption = {
    type: 'number',
    id: 'channel',
    label: 'Channel (0-based)',
    min: 0,
    max: maxChannel,
    default: 0,
    step: 1,
    range: false,
  };

  return {
    channel_state: {
      type: 'advanced',
      name: 'Channel State Color',
      description: 'Changes button color to reflect cue state. Standby + acknowledged shows light green.',
      options: [channelOption],
      callback: (feedback) => {
        const ch = instance.state.channels[feedback.options.channel];
        if (!ch) { return {}; }
        if (ch.state === 'standby' && ch.acked) { return COLOR.standbyAcked; }
        return COLOR[ch.state] ?? {};
      },
    },

    channel_acked: {
      type: 'boolean',
      name: 'Channel Acknowledged',
      description: 'True when the performer has tapped "I\'m Ready" on their phone.',
      defaultStyle: {
        bgcolor: combineRgb(74, 222, 128),
        color:   combineRgb(0,  0,   0),
      },
      options: [channelOption],
      callback: (feedback) => {
        const ch = instance.state.channels[feedback.options.channel];
        return !!ch?.acked;
      },
    },
  };
}
