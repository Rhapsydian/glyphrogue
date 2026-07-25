// Config UI's Audio tab logic (docs/design/editor.md: "Config UI" - the
// three 0-1 sliders via the narrow shared form primitive; "preview live"
// means actually hearing the mix while adjusting, using the same runtime
// playback mechanism a player would get). The dev fixture has no real
// sound asset to preview with, so this synthesizes a short test tone -
// editor-only (no real game ever needs a synthetic placeholder sound),
// unlike audio.js's playSound/playMusic themselves, which this reuses
// unmodified.
import { playMusic, playSound } from '@glyphrogue/core';

// A plain sine wave, built sample-by-sample - no external asset, no
// decode step (audio.js's own boundary: "an already-decoded AudioBuffer
// in", per its header comment). Mono is enough for a test tone.
export function createTestTone(audioCtx, { frequency = 440, durationSeconds = 0.5 } = {}) {
  const sampleRate = audioCtx.sampleRate;
  const frameCount = Math.round(sampleRate * durationSeconds);
  const buffer = audioCtx.createBuffer(1, frameCount, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    channel[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return buffer;
}

// Standard master/channel mixing - no existing precedent elsewhere in the
// codebase to match (audio.js's playSound/playMusic just take a plain
// volume, the composition is entirely caller convention), so this session
// establishes it: a channel's audible volume is master × its own slider.
export function effectiveVolume(mix, channel) {
  return mix.master * mix[channel];
}

export function previewMusic(audioCtx, buffer, mix) {
  return playMusic(audioCtx, buffer, { volume: effectiveVolume(mix, 'music') });
}

export function previewSfx(audioCtx, buffer, mix) {
  return playSound(audioCtx, buffer, { volume: effectiveVolume(mix, 'sfx') });
}

export function serializeMixSettings(mix) {
  return `export default ${JSON.stringify(mix, null, 2)};\n`;
}

export function audioSettingsPath() {
  return 'src/settings/audioSettings.js';
}
