// Advance-by-dt tween/effect bookkeeping (rendering.md's "Animation"
// section): the model jumps instantly, the view plays a tween to make that
// jump visually smooth. The actual requestAnimationFrame callback driving
// this isn't written here - no browser runtime package exists in this
// monorepo yet, same boundary as engine.js's run() needing an external
// driver core doesn't provide - so every function here is a pure function
// of an explicit `now`, callable from `node --test` with no real timers,
// per headless.test.js's discipline.

export function createAnimationState() {
  return { tweens: new Map(), effects: [] };
}

// Mutates state in place, same style as scheduler.js's addActor.
export function startTween(state, entity, { from, to, durationMs, startTime }) {
  state.tweens.set(entity, { from, to, durationMs, startTime });
}

// Purges tweens/effects whose end time has passed `now`. Pure function of
// `now` - no wall-clock reads.
export function advanceAnimation(state, now) {
  for (const [entity, tween] of state.tweens) {
    if (now >= tween.startTime + tween.durationMs) {
      state.tweens.delete(entity);
    }
  }
  state.effects = state.effects.filter((effect) => now < effect.startTime + effect.durationMs);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Returns `fallbackPosition` verbatim if the entity has no active tween.
export function tweenedPosition(state, entity, fallbackPosition, now) {
  const tween = state.tweens.get(entity);
  if (!tween) return fallbackPosition;

  const t = Math.min(Math.max((now - tween.startTime) / tween.durationMs, 0), 1);
  return { x: lerp(tween.from.x, tween.to.x, t), y: lerp(tween.from.y, tween.to.y, t) };
}

export function addTransientEffect(state, effect) {
  state.effects.push(effect);
}

// Pure filter, effects still alive at `now`.
export function activeEffects(state, now) {
  return state.effects.filter((effect) => now < effect.startTime + effect.durationMs);
}
