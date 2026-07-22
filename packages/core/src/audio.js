// The only module that ever touches AudioContext/AudioBufferSourceNode/
// GainNode, mirroring glyphRenderer.js's posture of being the sole
// real-platform-API-touching module in core, tested against a fake
// recording AudioContext. Per audio.md: no swappable backend (Web Audio is
// identical across every declared build target) - this is the one concrete
// implementation, not an interface.
//
// buffer is an already-decoded AudioBuffer-like object - decoding a
// registered sound's `source` URL into one is the caller's job (same
// "already-loaded data in, nothing fetched" boundary pixelyphImport.js
// draws for font manifests), keeping this module synchronous and testable
// with a plain fake, no promises involved.

function playBuffer(audioCtx, buffer, { volume = 1, loop = false } = {}) {
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = loop;

  const gain = audioCtx.createGain();
  gain.gain.value = volume;

  source.connect(gain);
  gain.connect(audioCtx.destination);
  source.start();

  return source;
}

export function playSound(audioCtx, buffer, { volume = 1 } = {}) {
  return playBuffer(audioCtx, buffer, { volume, loop: false });
}

export function playMusic(audioCtx, buffer, { volume = 1, loop = true } = {}) {
  return playBuffer(audioCtx, buffer, { volume, loop });
}
