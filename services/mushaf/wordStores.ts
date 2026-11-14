// @ai-generated
// RFC-023 step 2: the open WordStore of each rewayah. The rewayah the mushaf
// shows and the ones other surfaces read (the player's reciter, a copy or a
// share) are the same kind of store, so one registry keeps them all: a switch
// to a rewayah whose store is open reuses it, with no second connection and
// no second read of its verse index. It is the only place a store closes.
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {WordStore} from './wordStore';

// Stores that stay open while nothing shows them: the rewayah the mushaf
// showed before a switch, or the last one read once; the others close. A
// store holds a connection, its verse index (0.4 MB on V8) and its chunks:
// 24 chunks of texts are 3.3 MB, and 6 MB with their word infos and 1,024
// verses built.
const MAX_IDLE_STORES = 1;

export class WordStores {
  // In recency order, oldest first.
  private open = new Map<RewayahId, WordStore>();
  private loads = new Map<RewayahId, Promise<WordStore>>();
  private retainCounts = new Map<RewayahId, number>();
  private closes = new Set<Promise<void>>();
  private active: RewayahId | null = null;
  // Bumped by closeAll, so a load still running closes what it opened.
  private generation = 0;

  constructor(
    private readonly openStore: (rewayah: RewayahId) => Promise<WordStore>,
  ) {}

  /** The open store of `rewayah`, or undefined. */
  get(rewayah: RewayahId): WordStore | undefined {
    return this.open.get(rewayah);
  }

  /**
   * The open store of `rewayah`, now the most recently used one, or else one
   * load of it that every caller shares.
   */
  load(rewayah: RewayahId): Promise<WordStore> {
    const store = this.open.get(rewayah);
    if (store) {
      this.touch(rewayah);
      return Promise.resolve(store);
    }
    const pending = this.loads.get(rewayah);
    if (pending) return pending;
    const generation = this.generation;
    const load = this.openStore(rewayah).then(
      opened => {
        if (generation !== this.generation) {
          this.close(opened);
          throw new Error(`[WordStores] Closed while ${rewayah} loaded`);
        }
        this.loads.delete(rewayah);
        this.open.set(rewayah, opened);
        this.trim();
        return opened;
      },
      (error: unknown) => {
        if (this.loads.get(rewayah) === load) this.loads.delete(rewayah);
        throw error;
      },
    );
    this.loads.set(rewayah, load);
    return load;
  }

  /**
   * The mushaf shows `rewayah` now: its store stays open, and the store of
   * the rewayah it showed before is the most recently used idle one.
   */
  setActive(rewayah: RewayahId): void {
    const previous = this.active;
    this.active = rewayah;
    if (previous !== null) this.touch(previous);
    this.trim();
  }

  /**
   * Keeps the store of `rewayah` open while a mounted surface shows it, until
   * the returned function runs. Loads nothing.
   */
  retain(rewayah: RewayahId): () => void {
    this.retainCounts.set(rewayah, (this.retainCounts.get(rewayah) ?? 0) + 1);
    this.touch(rewayah);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const count = (this.retainCounts.get(rewayah) ?? 1) - 1;
      if (count > 0) this.retainCounts.set(rewayah, count);
      else this.retainCounts.delete(rewayah);
    };
  }

  /**
   * A read of `store` failed: it leaves the registry and closes. Returns the
   * rewayah it served, or null when it is no longer open (closeAll ran).
   */
  fail(store: WordStore): RewayahId | null {
    for (const [rewayah, open] of this.open) {
      if (open !== store) continue;
      this.open.delete(rewayah);
      this.close(store);
      return rewayah;
    }
    return null;
  }

  /**
   * Closes every store, and those still loading when they open. Resolves
   * when each close is done, a close already in flight too.
   */
  async closeAll(): Promise<void> {
    this.generation += 1;
    this.active = null;
    const loads = [...this.loads.values()];
    this.loads.clear();
    for (const store of this.open.values()) this.close(store);
    this.open.clear();
    await Promise.allSettled(loads);
    await Promise.all(this.closes);
  }

  private close(store: WordStore): void {
    const closed = store.close();
    this.closes.add(closed);
    const done = (): void => {
      this.closes.delete(closed);
    };
    closed.then(done, done);
  }

  private touch(rewayah: RewayahId): void {
    const store = this.open.get(rewayah);
    if (!store) return;
    this.open.delete(rewayah);
    this.open.set(rewayah, store);
  }

  // Closes the least recently used stores beyond MAX_IDLE_STORES that the
  // mushaf does not show and no surface retains. Runs when a store opens and
  // when the mushaf switches (not on a release, so a surface that mounts
  // again finds its store still open).
  private trim(): void {
    let idle = 0;
    for (const [rewayah, store] of [...this.open].reverse()) {
      if (rewayah === this.active) continue;
      if ((this.retainCounts.get(rewayah) ?? 0) > 0) continue;
      idle += 1;
      if (idle <= MAX_IDLE_STORES) continue;
      this.open.delete(rewayah);
      this.close(store);
    }
  }
}
