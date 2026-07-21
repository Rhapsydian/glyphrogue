// The render-event buffer (rendering.md: "confirmed necessary, not an
// optional design" - the model can race arbitrarily far ahead of the view
// on a busy multi-actor round, so rendering/audio consume a queue of
// pending visual/sound events at their own pace instead of reacting inline
// to dispatch). A single sequential FIFO consumed by one driver - not
// independent per-consumer cursors: audio.md reads off "this same
// render-event buffer" as just another event `kind` triggered synchronously
// as the queue advances, not a second reader competing for the same items.

export function createRenderEventQueue() {
  return { events: [] };
}

// event: { kind: 'animation' | 'sound', delay = 0, duration = 0, ...payload }
// delay: time after becoming current before the event's effect fires.
// duration: how long, counted from when it fires, the event blocks the
// queue from advancing (an animation's own tween length; a sound defaults
// to 0/0 - fires immediately, doesn't block, so the queue moves straight to
// the next event, typically the paired animation, in the same tick; a
// standalone sound can set duration to occupy its own slot).
export function enqueueRenderEvent(queue, event) {
  queue.events.push(event);
}

export function createSequencerState() {
  return { current: null, becameCurrentAt: null, triggered: false };
}

// Mutates `state` in place (same style as scheduler.js's addActor). Call
// every render tick with the current `now`. Pops the next event when idle;
// calls onTrigger(event) once `now` reaches becameCurrentAt + delay;
// advances past the event, recursing to immediately pull the next one at
// the same `now` (so a zero-duration event doesn't eat a whole tick), once
// `now` reaches trigger-time + duration.
export function advanceSequencer(queue, state, now, onTrigger) {
  if (!state.current) {
    if (queue.events.length === 0) return;
    state.current = queue.events.shift();
    state.becameCurrentAt = now;
    state.triggered = false;
  }

  const triggerAt = state.becameCurrentAt + (state.current.delay ?? 0);

  if (!state.triggered) {
    if (now < triggerAt) return;
    onTrigger(state.current);
    state.triggered = true;
  }

  const completeAt = triggerAt + (state.current.duration ?? 0);
  if (now >= completeAt) {
    state.current = null;
    state.becameCurrentAt = null;
    state.triggered = false;
    advanceSequencer(queue, state, now, onTrigger);
  }
}
