// Raw next-input capture (ui-and-input.md's rebind affordance) - the
// opposite contract from keyboardSource.js/gamepadSource.js, which only
// ever report an input already resolved through a keymap. This reports
// whichever raw key/button/axis fires next, regardless of binding state,
// so a "listen for your next keypress" UI can build a binding entry to
// hand to keymap.js's rebind(). Game-agnostic like the rest of this
// package - reusable by a real game's own future remap screen, not
// editor-only.

function pressedButtonIndex(buttons, previousButtons) {
  for (let index = 0; index < buttons.length; index++) {
    if (buttons[index] && !previousButtons[index]) return index;
  }
  return -1;
}

function crossedAxis(axes, previousAxes, deadzone) {
  for (let index = 0; index < axes.length; index++) {
    const value = axes[index] ?? 0;
    const previousValue = previousAxes[index] ?? 0;
    if (value > deadzone && previousValue <= deadzone) {
      return { device: 'gamepad-axis', index, direction: 'positive' };
    }
    if (value < -deadzone && previousValue >= -deadzone) {
      return { device: 'gamepad-axis', index, direction: 'negative' };
    }
  }
  return null;
}

export function createBindingCapture({ target, getGamepads, deadzone = 0.5 } = {}) {
  let onCapture = null;
  let primed = false;
  let previousButtons = [];
  let previousAxes = [];

  function handleKeyDown(event) {
    if (event.repeat) return;
    const callback = onCapture;
    stop();
    callback?.({ device: 'key', code: event.code });
  }

  function start(callback) {
    stop();
    onCapture = callback;
    primed = false;
    target?.addEventListener('keydown', handleKeyDown);
  }

  function stop() {
    target?.removeEventListener('keydown', handleKeyDown);
    onCapture = null;
  }

  // Driven once per animation frame by the caller while capture is active,
  // same as gamepadSource.js.poll() - but the first call after start()
  // only primes previousButtons/previousAxes rather than checking for
  // edges, so a button already held the moment capture begins doesn't
  // fire immediately.
  function poll() {
    if (!onCapture || !getGamepads) return;
    const gamepad = Array.from(getGamepads()).find((entry) => entry != null);
    if (!gamepad) return;

    const buttons = (gamepad.buttons ?? []).map((entry) => !!entry?.pressed);
    const axes = (gamepad.axes ?? []).map((entry) => entry ?? 0);

    if (!primed) {
      previousButtons = buttons;
      previousAxes = axes;
      primed = true;
      return;
    }

    const buttonIndex = pressedButtonIndex(buttons, previousButtons);
    if (buttonIndex !== -1) {
      const callback = onCapture;
      stop();
      callback?.({ device: 'gamepad-button', index: buttonIndex });
      return;
    }

    const axisBinding = crossedAxis(axes, previousAxes, deadzone);
    if (axisBinding) {
      const callback = onCapture;
      stop();
      callback?.(axisBinding);
      return;
    }

    previousButtons = buttons;
    previousAxes = axes;
  }

  return { start, stop, poll };
}
