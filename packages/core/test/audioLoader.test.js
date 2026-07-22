import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudioLoader, loadBuffer, getBuffer } from '../src/audioLoader.js';

function createFakeAudioContext() {
  const decodeCalls = [];
  return {
    decodeCalls,
    decodeAudioData(arrayBuffer) {
      decodeCalls.push(arrayBuffer);
      return Promise.resolve({ id: 'decoded', from: arrayBuffer });
    },
  };
}

test('loadBuffer decodes an ArrayBuffer and caches the result by id', async () => {
  const loader = createAudioLoader();
  const audioCtx = createFakeAudioContext();
  const arrayBuffer = { id: 'raw-bytes' };

  const buffer = await loadBuffer(loader, audioCtx, 'clang', arrayBuffer);

  assert.deepEqual(buffer, { id: 'decoded', from: arrayBuffer });
  assert.equal(getBuffer(loader, 'clang'), buffer);
  assert.equal(audioCtx.decodeCalls.length, 1);
});

test('loadBuffer returns the cached buffer on a repeat call without decoding again', async () => {
  const loader = createAudioLoader();
  const audioCtx = createFakeAudioContext();

  const first = await loadBuffer(loader, audioCtx, 'clang', { id: 'raw-bytes' });
  const second = await loadBuffer(loader, audioCtx, 'clang', { id: 'different-bytes' });

  assert.equal(second, first);
  assert.equal(audioCtx.decodeCalls.length, 1);
});

test('getBuffer returns undefined for an id that has never been loaded', () => {
  const loader = createAudioLoader();
  assert.equal(getBuffer(loader, 'never-loaded'), undefined);
});
