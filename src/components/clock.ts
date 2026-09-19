/**
 * A shared ticking clock for client components.
 *
 * Relative timestamps, countdowns and "last updated" all need to
 * re-render on time passing. Doing that with one interval and an
 * external store means N timers do not become N subscriptions, and the
 * components can read the value during render instead of writing state
 * from an effect.
 */

const TICK_MS = 1_000;

let current = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

export function subscribeClock(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) {
    timer = setInterval(() => {
      current = Date.now();
      for (const notify of listeners) {
        notify();
      }
    }, TICK_MS);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function getClockSnapshot(): number {
  if (current === 0) {
    current = Date.now();
  }
  return current;
}

/** Zero on the server, so the first paint renders a stable placeholder. */
export function getServerClockSnapshot(): number {
  return 0;
}
