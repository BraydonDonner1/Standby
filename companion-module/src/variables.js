// variables.js — variable definitions and value builders.
// Both functions accept the live channel array so definitions always match the server.

export function getVariableDefinitions(channels) {
  return channels.flatMap((ch) => [
    { variableId: `channel_${ch.id}_name`,  name: `Channel ${ch.id} Name` },
    { variableId: `channel_${ch.id}_state`, name: `Channel ${ch.id} State` },
    { variableId: `channel_${ch.id}_acked`, name: `Channel ${ch.id} Acknowledged (yes/no)` },
  ]);
}

export function buildVariableValues(channels) {
  const values = {};
  channels.forEach((ch) => {
    values[`channel_${ch.id}_name`]  = ch.name;
    values[`channel_${ch.id}_state`] = ch.state;
    values[`channel_${ch.id}_acked`] = ch.acked ? 'yes' : 'no';
  });
  return values;
}
