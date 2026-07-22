import { resolveBinding } from './keymap.js';

// Poll-based gamepad adapter (ui-and-input.md): the browser Gamepad API has
// no press/release events, so the consumer calls poll() once per animation
// frame and this diffs against the previous frame to edge-detect discrete
// press/release. Analog stick input becomes a discrete directional input
// action past `deadzone`, the same input action a d-pad press would fire -
// there's no continuous/analog input action anywhere in this pipeline.
// Scope boundary: single active gamepad only (first connected).

export function createGamepadSource({ getGamepads, keymap, deadzone = 0.5, dispatch }) {
  let previousButtons = [];
  let previousAxes = [];

  function emitButtonEdges(buttons) {
    const nextButtons = [];
    for (let index = 0; index < buttons.length; index++) {
      const pressed = !!buttons[index]?.pressed;
      const wasPressed = !!previousButtons[index];
      if (pressed !== wasPressed) {
        const phase = pressed ? 'press' : 'release';
        for (const action of resolveBinding(keymap, { device: 'gamepad-button', index })) {
          dispatch({ action, phase });
        }
      }
      nextButtons.push(pressed);
    }
    previousButtons = nextButtons;
  }

  function emitAxisEdge(index, direction, isActive) {
    const wasActive = !!previousAxes[index]?.[direction];
    if (isActive !== wasActive) {
      const phase = isActive ? 'press' : 'release';
      for (const action of resolveBinding(keymap, { device: 'gamepad-axis', index, direction })) {
        dispatch({ action, phase });
      }
    }
    return isActive;
  }

  function emitAxisEdges(axes) {
    const nextAxes = [];
    for (let index = 0; index < axes.length; index++) {
      const value = axes[index] ?? 0;
      nextAxes.push({
        positive: emitAxisEdge(index, 'positive', value > deadzone),
        negative: emitAxisEdge(index, 'negative', value < -deadzone),
      });
    }
    previousAxes = nextAxes;
  }

  return {
    poll() {
      const gamepad = Array.from(getGamepads()).find((entry) => entry != null);
      if (!gamepad) return;

      emitButtonEdges(gamepad.buttons ?? []);
      emitAxisEdges(gamepad.axes ?? []);
    },
  };
}
