/* eslint-env node, es2020 */
// A clock the replay moves by hand, so an hour of recitation takes a moment and the model
// takes exactly as long as the phone is assumed to. The app's bundle reads its time and
// timers from here (build.mjs). What really runs meanwhile, the model, is waited for
// before the clock moves on, so its real speed never changes what happens.

export function createClock() {
  let now = 1_000_000;
  let seq = 0;
  // Sorted by time, then by rank, then by order made. Few timers live at once.
  let queue = [];
  const real = new Set();

  function insert(entry) {
    let i = queue.length;
    while (i > 0) {
      const b = queue[i - 1];
      if (
        b.at < entry.at ||
        (b.at === entry.at &&
          (b.rank < entry.rank || (b.rank === entry.rank && b.seq < entry.seq)))
      ) {
        break;
      }
      i -= 1;
    }
    queue.splice(i, 0, entry);
  }
  function add(fn, ms, rank, every) {
    const entry = {
      id: ++seq,
      seq,
      at: now + Math.max(0, Number(ms) || 0),
      rank,
      fn,
      every,
    };
    insert(entry);
    return entry.id;
  }
  const cancel = id => {
    const i = queue.findIndex(e => e.id === id);
    if (i >= 0) queue.splice(i, 1);
  };
  const settle = async () => {
    for (;;) {
      await new Promise(resolve => setImmediate(resolve));
      if (real.size === 0) {
        await new Promise(resolve => setImmediate(resolve));
        if (real.size === 0) return;
      } else {
        await Promise.allSettled([...real]);
      }
    }
  };
  return {
    // What the bundle sees.
    now: () => now,
    setTimeout: (fn, ms) => add(fn, ms, 0, null),
    clearTimeout: cancel,
    setInterval: (fn, ms) => add(fn, ms, 0, ms),
    clearInterval: cancel,
    // What the replay uses.
    at: (ms, rank, fn) => add(fn, ms - now, rank, null),
    /** Work that really runs: the clock waits for it before moving on. */
    realWork(promise) {
      real.add(promise);
      promise.finally(() => real.delete(promise)).catch(() => undefined);
      return promise;
    },
    settle,
    /** Runs everything due up to this time, in order. */
    async runTo(limit) {
      await settle();
      while (queue.length && queue[0].at <= limit) {
        const e = queue.shift();
        now = e.at;
        if (e.every !== null) {
          e.at = now + e.every;
          e.seq = ++seq;
          insert(e);
        }
        e.fn();
        await settle();
      }
      now = Math.max(now, limit);
    },
    /** Forgets what a finished take left behind. */
    clear() {
      queue = [];
    },
  };
}
