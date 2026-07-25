import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKeybindingRows,
  addBinding,
  removeBinding,
  serializeKeybindings,
  keybindingsPath,
} from '../src/configKeybindings.js';

test('buildKeybindingRows produces one row per input action, in the given order, even with zero bindings', () => {
  const bindings = { 'move-north': [{ device: 'key', code: 'ArrowUp' }] };
  const rows = buildKeybindingRows(bindings, ['move-north', 'move-south']);
  assert.deepEqual(rows, [
    { action: 'move-north', entries: [{ entry: { device: 'key', code: 'ArrowUp' }, label: 'Key: ArrowUp' }] },
    { action: 'move-south', entries: [] },
  ]);
});

test('buildKeybindingRows labels every binding device kind', () => {
  const bindings = {
    interact: [
      { device: 'key', code: 'KeyE' },
      { device: 'gamepad-button', index: 0 },
      { device: 'gamepad-axis', index: 1, direction: 'negative' },
    ],
  };
  const rows = buildKeybindingRows(bindings, ['interact']);
  assert.deepEqual(
    rows[0].entries.map((e) => e.label),
    ['Key: KeyE', 'Gamepad button 0', 'Gamepad axis 1 (negative)']
  );
});

test('addBinding appends to an existing action without mutating the input', () => {
  const bindings = { 'move-north': [{ device: 'key', code: 'ArrowUp' }] };
  const next = addBinding(bindings, 'move-north', { device: 'key', code: 'KeyW' });
  assert.deepEqual(next['move-north'], [
    { device: 'key', code: 'ArrowUp' },
    { device: 'key', code: 'KeyW' },
  ]);
  assert.equal(bindings['move-north'].length, 1);
});

test('addBinding creates a new action entry when none exists yet', () => {
  const next = addBinding({}, 'jump', { device: 'key', code: 'Space' });
  assert.deepEqual(next, { jump: [{ device: 'key', code: 'Space' }] });
});

test('removeBinding drops exactly the binding at index for that action', () => {
  const bindings = {
    'move-north': [
      { device: 'key', code: 'ArrowUp' },
      { device: 'key', code: 'KeyW' },
    ],
  };
  const next = removeBinding(bindings, 'move-north', 0);
  assert.deepEqual(next['move-north'], [{ device: 'key', code: 'KeyW' }]);
});

test('serializeKeybindings emits a default-exported JS module matching loadKeybindings defaults shape', () => {
  const source = serializeKeybindings({ 'move-north': [{ device: 'key', code: 'ArrowUp' }] });
  assert.equal(
    source,
    'export default {\n  "move-north": [\n    {\n      "device": "key",\n      "code": "ArrowUp"\n    }\n  ]\n};\n'
  );
});

test('keybindingsPath returns the default settings destination', () => {
  assert.equal(keybindingsPath(), 'src/settings/keybindings.js');
});
