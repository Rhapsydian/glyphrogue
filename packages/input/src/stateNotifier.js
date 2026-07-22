// The coarse DOM state-binding primitive (ui-and-input.md): a subscriber
// is notified once after each fully-resolved core Action and re-reads
// whatever it needs through core's inspection API, rather than
// fine-grained dependency-tracked subscriptions. When exactly to call
// notify() is the consumer's job - this is just the subscribe/notify
// mechanism itself.

export function createNotifier() {
  const listeners = new Set();
  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    notify() {
      for (const fn of listeners) fn();
    },
  };
}
