// Optional first-party convenience wrapping decodeAudioData + a cache keyed
// by id, same "first-party but not mandatory" precedent as memory.js -
// audio.js's playSound/playMusic only ever need an already-decoded
// AudioBuffer, so a game is free to manage decoding/caching itself instead.
//
// Takes an already-fetched ArrayBuffer, not a URL - core never performs
// network I/O anywhere (fonts/tileset manifests/zone templates are the same
// "already-loaded data in" boundary), so fetching the bytes stays the
// caller's one-line concern.

export function createAudioLoader() {
  return { buffers: new Map() };
}

export function loadBuffer(loader, audioCtx, id, arrayBuffer) {
  const cached = loader.buffers.get(id);
  if (cached) return Promise.resolve(cached);

  return audioCtx.decodeAudioData(arrayBuffer).then((buffer) => {
    loader.buffers.set(id, buffer);
    return buffer;
  });
}

export function getBuffer(loader, id) {
  return loader.buffers.get(id);
}
