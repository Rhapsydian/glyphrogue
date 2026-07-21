// mulberry32 - a small, fast, zero-dependency 32-bit PRNG. `state` is a
// plain, directly readable/writable number so save/load (checkpoint 2) can
// snapshot and restore it without a separate getter/setter pair.
export function createRng(seed) {
  const rng = {
    state: seed >>> 0,
    next() {
      rng.state = (rng.state + 0x6d2b79f5) >>> 0;
      let t = rng.state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
  return rng;
}
