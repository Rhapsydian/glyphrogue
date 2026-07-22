// Where the "exclusive capture stack" decision actually lives: every input
// action goes to whichever UI surface is topmost on the stack; if nothing
// is on the stack, it falls through. Which input-action ids are
// "gameplay-intent" (worth turning into a core Action) vs. UI-only is
// entirely the consumer's business inside onFallthrough - this pipeline
// has no opinion on input-action vocabulary (ui-and-input.md).

export function createInputPipeline({ captureStack, onCaptured, onFallthrough }) {
  return {
    handleInputAction({ action, phase }) {
      if (!captureStack.isEmpty()) {
        onCaptured({ action, phase, surfaceId: captureStack.peek() });
      } else {
        onFallthrough({ action, phase });
      }
    },
  };
}
