import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTestTone,
  effectiveVolume,
  previewMusic,
  previewSfx,
  serializeMixSettings,
  audioSettingsPath,
} from '../src/configAudio.js';

// A fake AudioContext standing in for the real Web Audio API, extending
// core's audio.test.js pattern with createBuffer/sampleRate for the
// synthesized test tone.
function createFakeAudioContext({ sampleRate = 44100 } = {}) {
  const calls = [];
  return {
    calls,
    sampleRate,
    destination: { id: 'destination' },
    createBuffer(channels, frameCount, rate) {
      calls.push({ method: 'createBuffer', args: [channels, frameCount, rate] });
      const data = new Float64Array(frameCount);
      return {
        getChannelData: () => data,
      };
    },
    createBufferSource() {
      calls.push({ method: 'createBufferSource', args: [] });
      const node = {
        buffer: null,
        loop: false,
        connect() {},
        start() {},
      };
      return node;
    },
    createGain() {
      calls.push({ method: 'createGain', args: [] });
      return { gain: { value: 1 }, connect() {} };
    },
  };
}

test('createTestTone builds a mono AudioBuffer of the requested duration', () => {
  const audioCtx = createFakeAudioContext({ sampleRate: 100 });
  const buffer = createTestTone(audioCtx, { frequency: 10, durationSeconds: 0.5 });

  assert.deepEqual(
    audioCtx.calls.map((c) => c.method),
    ['createBuffer'],
  );
  assert.equal(audioCtx.calls[0].args[0], 1);
  assert.equal(audioCtx.calls[0].args[1], 50);
});

test('createTestTone fills the buffer with a sine wave starting at zero', () => {
  const audioCtx = createFakeAudioContext({ sampleRate: 100 });
  const buffer = createTestTone(audioCtx, { frequency: 10, durationSeconds: 0.1 });

  const data = buffer.getChannelData();
  assert.equal(data[0], 0);
  assert.ok(data.some((sample) => sample !== 0));
  for (const sample of data) {
    assert.ok(sample >= -1 && sample <= 1);
  }
});

test('effectiveVolume multiplies master by the named channel', () => {
  assert.equal(effectiveVolume({ master: 0.5, music: 0.8, sfx: 1 }, 'music'), 0.4);
  assert.equal(effectiveVolume({ master: 0.5, music: 0.8, sfx: 1 }, 'sfx'), 0.5);
});

test('previewMusic plays looping, at master × music volume', () => {
  const audioCtx = createFakeAudioContext();
  const gainNodes = [];
  const originalCreateGain = audioCtx.createGain.bind(audioCtx);
  audioCtx.createGain = () => {
    const node = originalCreateGain();
    gainNodes.push(node);
    return node;
  };
  const buffer = createTestTone(audioCtx);

  const source = previewMusic(audioCtx, buffer, { master: 0.5, music: 0.6, sfx: 1 });

  assert.equal(source.loop, true);
  assert.equal(gainNodes[0].gain.value, 0.3);
});

test('previewSfx plays non-looping, at master × sfx volume', () => {
  const audioCtx = createFakeAudioContext();
  const gainNodes = [];
  const originalCreateGain = audioCtx.createGain.bind(audioCtx);
  audioCtx.createGain = () => {
    const node = originalCreateGain();
    gainNodes.push(node);
    return node;
  };
  const buffer = createTestTone(audioCtx);

  const source = previewSfx(audioCtx, buffer, { master: 0.5, music: 1, sfx: 0.4 });

  assert.equal(source.loop, false);
  assert.equal(gainNodes[0].gain.value, 0.2);
});

test('serializeMixSettings emits a default-exported JS module matching loadMixSettings defaults shape', () => {
  const source = serializeMixSettings({ master: 1, music: 0.7, sfx: 0.7 });
  assert.equal(source, 'export default {\n  "master": 1,\n  "music": 0.7,\n  "sfx": 0.7\n};\n');
});

test('audioSettingsPath returns the default settings destination', () => {
  assert.equal(audioSettingsPath(), 'src/settings/audioSettings.js');
});
