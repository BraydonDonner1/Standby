// actions.js — action definitions. channelCount drives the valid range for the channel picker.

export function getActionDefinitions(instance, channelCount) {
  const maxChannel = Math.max(0, channelCount - 1);

  return {
    set_cue: {
      name: 'Set Channel State',
      options: [
        {
          type: 'number',
          id: 'channel',
          label: 'Channel (0-based)',
          min: 0,
          max: maxChannel,
          default: 0,
          step: 1,
          range: false,
        },
        {
          type: 'dropdown',
          id: 'state',
          label: 'State',
          choices: [
            { id: 'standby', label: 'Standby' },
            { id: 'go',      label: 'Go' },
            { id: 'clear',   label: 'Clear' },
          ],
          default: 'standby',
        },
      ],
      callback: async (action) => {
        await instance.sendCue(action.options.channel, action.options.state);
      },
    },

    batch_cue: {
      name: 'Set Multiple Channels',
      options: [
        {
          type: 'textinput',
          id: 'ids',
          label: 'Channel IDs (comma-separated, e.g. 0,2,5)',
          default: '0,1',
        },
        {
          type: 'dropdown',
          id: 'state',
          label: 'State',
          choices: [
            { id: 'standby', label: 'Standby' },
            { id: 'go',      label: 'Go' },
            { id: 'clear',   label: 'Clear' },
          ],
          default: 'standby',
        },
      ],
      callback: async (action) => {
        const ids = action.options.ids
          .split(',')
          .map(s => parseInt(s.trim(), 10))
          .filter(n => !Number.isNaN(n));
        await instance.sendBatchCue(ids, action.options.state);
      },
    },

    clear_all: {
      name: 'Clear All Channels',
      options: [],
      callback: async () => {
        await instance.sendClearAll();
      },
    },
  };
}
