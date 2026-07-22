import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playSound, playMusic } from '../src/audio.js';

// A fake AudioContext standing in for the real Web Audio API - records
// every node created/connected/started, so tests assert on the recorded
// sequence instead of needing a real audio device, same posture as
// glyphRenderer.test.js's fake ctx.
function createFakeAudioContext() {
  const calls = [];
  const destination = { id: 'destination' };
  return {
    calls,
    destination,
    createBufferSource() {
      const node = {
        buffer: null,
        loop: false,
        connect(target) {
          calls.push({ method: 'source.connect', args: [target] });
        },
        start() {
          calls.push({ method: 'source.start', args: [] });
        },
      };
      calls.push({ method: 'createBufferSource', args: [] });
      return node;
    },
    createGain() {
      const node = {
        gain: { value: 1 },
        connect(target) {
          calls.push({ method: 'gain.connect', args: [target] });
        },
      };
      calls.push({ method: 'createGain', args: [] });
      return node;
    },
  };
}

test('playSound wires a buffer source through a gain node to destination, non-looping', () => {
  const audioCtx = createFakeAudioContext();
  const buffer = { id: 'clang-buffer' };

  const source = playSound(audioCtx, buffer, { volume: 0.5 });

  assert.equal(source.buffer, buffer);
  assert.equal(source.loop, false);
  assert.deepEqual(
    audioCtx.calls.map((c) => c.method),
    ['createBufferSource', 'createGain', 'source.connect', 'gain.connect', 'source.start'],
  );
});

test('playSound defaults volume to 1', () => {
  const audioCtx = createFakeAudioContext();
  const gainNodes = [];
  const originalCreateGain = audioCtx.createGain.bind(audioCtx);
  audioCtx.createGain = () => {
    const node = originalCreateGain();
    gainNodes.push(node);
    return node;
  };

  playSound(audioCtx, { id: 'buf' });

  assert.equal(gainNodes[0].gain.value, 1);
});

test('playMusic loops by default', () => {
  const audioCtx = createFakeAudioContext();

  const source = playMusic(audioCtx, { id: 'theme-buffer' });

  assert.equal(source.loop, true);
});

test('playMusic can opt out of looping', () => {
  const audioCtx = createFakeAudioContext();

  const source = playMusic(audioCtx, { id: 'sting-buffer' }, { loop: false });

  assert.equal(source.loop, false);
});
