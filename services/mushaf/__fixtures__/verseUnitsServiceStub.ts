// @ai-generated
/**
 * Test-only stand-in for rewayahVerseUnitsService (for jest.mock factories):
 * the API the app calls (peek, getStatus, getError, request, retry,
 * subscribe, getVersion), answered by `peek` and `status`. Like the real
 * service it never builds on a read: request() and retry() resolve with
 * what peek() gives, and notify() plays the end of a build (the version
 * changes and subscribers are called). Not imported by app code.
 *
 *   jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
 *     rewayahVerseUnitsService: jest
 *       .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
 *       .verseUnitsServiceStub({peek: () => null, status: () => 'error'}),
 *   }));
 */

export interface VerseUnitsServiceStub {
  peek(rewayah: string): unknown;
  getStatus(rewayah: string): string;
  getError(rewayah: string): unknown;
  request(rewayah: string): Promise<unknown>;
  retry(rewayah: string): Promise<unknown>;
  subscribe(listener: () => void): () => void;
  getVersion(): number;
  /** Ends a build: bumps the version and calls the subscribers. */
  notify(): void;
  /** Rewayat passed to request() / retry(), in order. */
  readonly requested: string[];
  readonly retried: string[];
}

export function verseUnitsServiceStub(options: {
  peek: (rewayah: string) => unknown;
  /** Status while peek() gives nothing ('ready' otherwise); default 'error'. */
  status?: (rewayah: string) => string;
}): VerseUnitsServiceStub {
  const listeners = new Set<() => void>();
  let version = 0;
  const stub: VerseUnitsServiceStub = {
    peek: rewayah => options.peek(rewayah) ?? null,
    getStatus: rewayah =>
      options.peek(rewayah) ? 'ready' : (options.status?.(rewayah) ?? 'error'),
    getError: () => null,
    request(rewayah) {
      stub.requested.push(rewayah);
      return Promise.resolve(options.peek(rewayah) ?? null);
    },
    retry(rewayah) {
      stub.retried.push(rewayah);
      return Promise.resolve(options.peek(rewayah) ?? null);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getVersion: () => version,
    notify() {
      version += 1;
      for (const listener of [...listeners]) listener();
    },
    requested: [],
    retried: [],
  };
  return stub;
}
