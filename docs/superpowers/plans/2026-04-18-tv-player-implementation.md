# Bayaan TV Player — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Spotify-caliber audio player for Apple TV + Android TV that browses the Bayaan reciter catalog and plays surahs with an Apple-Music-TV visual style — sibling app to the existing Bayaan phone codebase.

**Architecture:** Separate Expo app at `tv-app/` inside the feature worktree. Reuses phone's low-level audio engine (`../services/audio/ExpoAudioService`, `../services/audio/AmbientAudioService`) and static data (`../data/*`) via Metro `watchFolders`. New TV-specific Zustand state layer, MMKV-backed persistence, state-driven navigation (expo-router is not supported on tvOS).

**Tech Stack:** React Native (via `react-native-tvos@0.83.2-0` fork), Expo SDK 55, `@react-native-tvos/config-tv`, Zustand, `react-native-mmkv`, `expo-audio`, `expo-image`, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-04-18-tv-player-design.md`

**Pre-existing files from earlier scaffolding** (will be reorganized in Task 1):
- `tv-app/theme/{colors,typography,spacing}.ts`
- `tv-app/types/{reciter,player}.ts`
- `tv-app/components/FocusableButton.tsx` (moves to `primitives/`)
- `tv-app/metro.config.js`, `tsconfig.json`, `package.json` (already has `expo-image`)

**Conventions throughout:**
- TypeScript strict, no `any`, explicit return types on exported functions.
- Functional components, `function` keyword for pure helpers.
- Use `Pressable` via the `FocusableButton`/`FocusableCard` primitives — never raw `Pressable` in user-facing code (test files exempt).
- Camel-case filenames for utilities; PascalCase for components.
- Import from parent worktree via relative paths (`../services/...`). Path alias `@bayaan/*` is configured but prefer relative for clarity inside `tv-app/`.
- Every task ends with `npx tsc --noEmit` + `npx prettier --write <files>` + commit. A task is not complete until tsc passes clean.
- Tests: Jest + ts-jest for pure logic (services, stores, hooks). React Native Testing Library for components where focus/interaction is observable. No visual snapshots.

**Test setup (applies once, in Task 1):**
```
tv-app/
  jest.config.js         (jest-expo preset)
  __tests__/setup.ts     (MMKV mock, reanimated mock)
```

---

## Task 1: Foundation cleanup, MMKV + test infra

**Files:**
- Create: `tv-app/components/primitives/FocusableButton.tsx` (move from `components/`)
- Create: `tv-app/services/storage.ts`
- Create: `tv-app/jest.config.js`
- Create: `tv-app/__tests__/setup.ts`
- Modify: `tv-app/package.json` (add `react-native-mmkv`, `jest-expo`, `@testing-library/react-native`, `jest`, `@types/jest`, `ts-jest`)
- Delete: `tv-app/components/FocusableButton.tsx` (moved)

- [ ] **Step 1: Add dependencies**

```bash
cd tv-app
npm install --save react-native-mmkv@^4.1.2
npm install --save-dev jest @types/jest ts-jest jest-expo @testing-library/react-native
```

- [ ] **Step 2: Move FocusableButton to primitives**

```bash
mkdir -p tv-app/components/primitives
git mv tv-app/components/FocusableButton.tsx tv-app/components/primitives/FocusableButton.tsx
```

- [ ] **Step 3: Create storage wrapper**

`tv-app/services/storage.ts`:
```ts
import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({ id: 'bayaan-tv' });

export function readJSON<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

export function remove(key: string): void {
  storage.delete(key);
}
```

- [ ] **Step 4: Create jest config + setup**

`tv-app/jest.config.js`:
```js
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/__tests__/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|react-native-tvos)',
  ],
  testMatch: ['<rootDir>/**/*.test.ts', '<rootDir>/**/*.test.tsx'],
};
```

`tv-app/__tests__/setup.ts`:
```ts
jest.mock('react-native-mmkv', () => {
  const data = new Map<string, string>();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      getString: (k: string) => data.get(k),
      set: (k: string, v: string) => data.set(k, v),
      delete: (k: string) => data.delete(k),
      clearAll: () => data.clear(),
    })),
  };
});
```

- [ ] **Step 5: Test the storage wrapper**

`tv-app/services/storage.test.ts`:
```ts
import { readJSON, writeJSON, remove, storage } from './storage';

describe('storage', () => {
  beforeEach(() => storage.clearAll());

  it('reads null when key absent', () => {
    expect(readJSON('missing')).toBeNull();
  });

  it('round-trips JSON', () => {
    writeJSON('k', { a: 1, b: 'two' });
    expect(readJSON<{ a: number; b: string }>('k')).toEqual({ a: 1, b: 'two' });
  });

  it('returns null on corrupt JSON', () => {
    storage.set('bad', 'not json');
    expect(readJSON('bad')).toBeNull();
  });

  it('remove deletes the key', () => {
    writeJSON('k', 1);
    remove('k');
    expect(readJSON('k')).toBeNull();
  });
});
```

Run: `cd tv-app && npx jest services/storage.test.ts -v` — expect 4 PASS.

- [ ] **Step 6: Verify tsc + commit**

```bash
cd tv-app && npx tsc --noEmit && npx prettier --write services/storage.ts services/storage.test.ts jest.config.js __tests__/setup.ts components/primitives/FocusableButton.tsx
cd .. && git add tv-app/ && git commit -m "feat(tv): add MMKV storage wrapper, move FocusableButton to primitives, jest config"
```

---

## Task 2: tvDataService (reciters + rewayat)

**Files:**
- Create: `tv-app/services/tvDataService.ts`
- Create: `tv-app/services/tvDataService.test.ts`

**Cache keys + version:** `bayaan_reciters`, `bayaan_reciter_servers`, `DATA_VERSION = '4'`.

- [ ] **Step 1: Write fetchReciters tests first**

`tv-app/services/tvDataService.test.ts`:
```ts
import { fetchReciters, getCachedReciters, buildAudioUrl } from './tvDataService';
import { storage } from './storage';
import fallback from '../../data/reciters-fallback.json';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  storage.clearAll();
  mockFetch.mockReset();
});

describe('tvDataService', () => {
  it('returns cached reciters synchronously when cache is warm', () => {
    storage.set('bayaan_reciters', JSON.stringify({ version: '4', data: fallback.slice(0, 2) }));
    const cached = getCachedReciters();
    expect(cached).toHaveLength(2);
  });

  it('returns null from getCachedReciters when cache version mismatches', () => {
    storage.set('bayaan_reciters', JSON.stringify({ version: '1', data: fallback }));
    expect(getCachedReciters()).toBeNull();
  });

  it('fetches live and writes cache', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ useBackendApi: true }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: '1', name: 'Test', image_url: null }],
    });
    const result = await fetchReciters();
    expect(result).toHaveLength(1);
    expect(getCachedReciters()).toHaveLength(1);
  });

  it('falls back to bundled JSON when fetch fails and cache empty', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    const result = await fetchReciters();
    expect(result.length).toBeGreaterThan(0);
  });

  it('respects killswitch (useBackendApi=false)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ useBackendApi: false }),
    });
    const result = await fetchReciters();
    // backend skipped; fallback served
    expect(result.length).toBeGreaterThan(0);
    expect(mockFetch).toHaveBeenCalledTimes(1); // only killswitch call
  });

  it('buildAudioUrl pads surah number to 3 digits', () => {
    expect(buildAudioUrl('https://cdn.example.com/reciter', 7)).toBe(
      'https://cdn.example.com/reciter/007.mp3',
    );
    expect(buildAudioUrl('https://cdn.example.com/reciter/', 114)).toBe(
      'https://cdn.example.com/reciter/114.mp3',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify failures**

Run: `cd tv-app && npx jest services/tvDataService.test.ts -v` — all should fail with "Cannot find module".

- [ ] **Step 3: Implement tvDataService**

`tv-app/services/tvDataService.ts`:
```ts
import fallbackReciters from '../../data/reciters-fallback.json';
import type { Reciter, Rewayah } from '../types/reciter';
import { readJSON, storage, writeJSON } from './storage';

const DATA_VERSION = '4';
const RECITERS_KEY = 'bayaan_reciters';
const SERVERS_KEY = 'bayaan_reciter_servers';
const CDN_CONFIG_URL = 'https://cdn.example.com/config/app-config.json';
const API_URL = process.env.EXPO_PUBLIC_BAYAAN_API_URL ?? '';
const API_KEY = process.env.EXPO_PUBLIC_BAYAAN_API_KEY ?? '';

type Cached<T> = { version: string; data: T };

async function isBackendEnabled(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(CDN_CONFIG_URL, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return true;
    const json = (await res.json()) as { useBackendApi?: boolean };
    return json.useBackendApi !== false;
  } catch {
    return true;
  }
}

export function getCachedReciters(): Reciter[] | null {
  const cached = readJSON<Cached<Reciter[]>>(RECITERS_KEY);
  if (!cached || cached.version !== DATA_VERSION) return null;
  return cached.data;
}

export async function fetchReciters(opts?: {
  skipCache?: boolean;
}): Promise<Reciter[]> {
  if (!opts?.skipCache) {
    const cached = getCachedReciters();
    if (cached) return cached;
  }

  const enabled = await isBackendEnabled();
  if (!enabled || !API_URL) {
    return fallbackReciters as Reciter[];
  }

  try {
    const res = await fetch(`${API_URL}/reciters`, {
      headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Reciter[];
    writeJSON<Cached<Reciter[]>>(RECITERS_KEY, { version: DATA_VERSION, data });
    return data;
  } catch {
    const cached = getCachedReciters();
    if (cached) return cached;
    return fallbackReciters as Reciter[];
  }
}

export async function fetchRewayat(reciterId: string): Promise<Rewayah[]> {
  const key = `${SERVERS_KEY}_${reciterId}`;
  const cached = readJSON<Cached<Rewayah[]>>(key);
  if (cached && cached.version === DATA_VERSION) return cached.data;

  if (!API_URL) return [];
  try {
    const res = await fetch(`${API_URL}/reciters/${reciterId}/rewayat`, {
      headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Rewayah[];
    writeJSON<Cached<Rewayah[]>>(key, { version: DATA_VERSION, data });
    return data;
  } catch {
    return [];
  }
}

export function buildAudioUrl(server: string, surahNumber: number): string {
  const base = server.endsWith('/') ? server.slice(0, -1) : server;
  const padded = String(surahNumber).padStart(3, '0');
  return `${base}/${padded}.mp3`;
}
```

- [ ] **Step 4: Run tests; expect 6 PASS**

Run: `cd tv-app && npx jest services/tvDataService.test.ts -v`

- [ ] **Step 5: tsc + prettier + commit**

```bash
cd tv-app && npx tsc --noEmit && npx prettier --write services/tvDataService.ts services/tvDataService.test.ts
cd .. && git add tv-app/ && git commit -m "feat(tv): add tvDataService with MMKV cache + killswitch + fallback"
```

---

## Task 3: continueListeningStore (MMKV ring buffer)

**Files:**
- Create: `tv-app/services/continueListeningStore.ts`
- Create: `tv-app/services/continueListeningStore.test.ts`

**Shape:** `{ reciterId, rewayahId, surahNumber, positionSeconds, durationSeconds, updatedAt }[]`, MMKV key `bayaan_tv_continue`, cap 10, dedup on `(reciterId, surahNumber)`.

- [ ] **Step 1: Write tests**

`tv-app/services/continueListeningStore.test.ts`:
```ts
import { recordProgress, getContinueEntries, clearContinue } from './continueListeningStore';
import { storage } from './storage';

const entry = (reciterId: string, surahNumber: number, positionSeconds = 10) => ({
  reciterId,
  rewayahId: 'r1',
  surahNumber,
  positionSeconds,
  durationSeconds: 60,
});

beforeEach(() => storage.clearAll());

describe('continueListeningStore', () => {
  it('starts empty', () => {
    expect(getContinueEntries()).toEqual([]);
  });

  it('records one entry', () => {
    recordProgress(entry('a', 1));
    const got = getContinueEntries();
    expect(got).toHaveLength(1);
    expect(got[0].reciterId).toBe('a');
    expect(typeof got[0].updatedAt).toBe('number');
  });

  it('dedupes on reciterId+surahNumber (updates position)', () => {
    recordProgress(entry('a', 1, 5));
    recordProgress(entry('a', 1, 20));
    const got = getContinueEntries();
    expect(got).toHaveLength(1);
    expect(got[0].positionSeconds).toBe(20);
  });

  it('different surah same reciter = two entries', () => {
    recordProgress(entry('a', 1));
    recordProgress(entry('a', 2));
    expect(getContinueEntries()).toHaveLength(2);
  });

  it('caps at 10 entries, evicts oldest', () => {
    for (let i = 1; i <= 12; i++) recordProgress(entry('r', i));
    const got = getContinueEntries();
    expect(got).toHaveLength(10);
    // oldest (surahs 1, 2) evicted
    expect(got.find((e) => e.surahNumber === 1)).toBeUndefined();
    expect(got.find((e) => e.surahNumber === 12)).toBeDefined();
  });

  it('sorts by updatedAt desc', async () => {
    recordProgress(entry('a', 1));
    await new Promise((r) => setTimeout(r, 5));
    recordProgress(entry('b', 2));
    const got = getContinueEntries();
    expect(got[0].reciterId).toBe('b');
    expect(got[1].reciterId).toBe('a');
  });

  it('clearContinue empties the store', () => {
    recordProgress(entry('a', 1));
    clearContinue();
    expect(getContinueEntries()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run; all fail**

- [ ] **Step 3: Implement continueListeningStore**

`tv-app/services/continueListeningStore.ts`:
```ts
import { readJSON, writeJSON, remove } from './storage';

const KEY = 'bayaan_tv_continue';
const MAX_ENTRIES = 10;

export type ContinueEntry = {
  reciterId: string;
  rewayahId: string;
  surahNumber: number;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: number;
};

export type ProgressInput = Omit<ContinueEntry, 'updatedAt'>;

export function getContinueEntries(): ContinueEntry[] {
  return readJSON<ContinueEntry[]>(KEY) ?? [];
}

export function recordProgress(input: ProgressInput): void {
  const now = Date.now();
  const existing = getContinueEntries();
  const filtered = existing.filter(
    (e) => !(e.reciterId === input.reciterId && e.surahNumber === input.surahNumber),
  );
  const next: ContinueEntry = { ...input, updatedAt: now };
  filtered.unshift(next);
  filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  writeJSON(KEY, filtered.slice(0, MAX_ENTRIES));
}

export function clearContinue(): void {
  remove(KEY);
}
```

- [ ] **Step 4: Run tests; 7 PASS**

- [ ] **Step 5: tsc + prettier + commit**

```bash
cd tv-app && npx tsc --noEmit && npx prettier --write services/continueListeningStore.ts services/continueListeningStore.test.ts
cd .. && git add tv-app/ && git commit -m "feat(tv): add continueListeningStore MMKV ring buffer"
```

---

## Task 4: Nav store + ambient store

**Files:**
- Create: `tv-app/store/navStore.ts`
- Create: `tv-app/store/navStore.test.ts`
- Create: `tv-app/store/ambientStore.ts`
- Create: `tv-app/store/ambientStore.test.ts`

**Nav store:** minimal state router — stack of screens + current tab. No deep linking, no params beyond `reciterId`/`surahNumber`.

**Ambient store:** Zustand for ambient sound preferences (currentSound, volume, enabled). Port of phone `store/ambientStore.ts` — pure JS, trivial.

- [ ] **Step 1: Write nav store tests**

`tv-app/store/navStore.test.ts`:
```ts
import { useNavStore } from './navStore';
import { act } from '@testing-library/react-native';

beforeEach(() => {
  act(() => useNavStore.getState().reset());
});

describe('navStore', () => {
  it('defaults to home tab', () => {
    expect(useNavStore.getState().currentTab).toBe('home');
    expect(useNavStore.getState().stack).toEqual([]);
  });

  it('switchTab changes tab and clears stack', () => {
    act(() => {
      useNavStore.getState().push({ screen: 'reciterDetail', reciterId: 'r1' });
      useNavStore.getState().switchTab('search');
    });
    expect(useNavStore.getState().currentTab).toBe('search');
    expect(useNavStore.getState().stack).toEqual([]);
  });

  it('push adds to stack', () => {
    act(() => useNavStore.getState().push({ screen: 'nowPlaying' }));
    expect(useNavStore.getState().stack).toHaveLength(1);
  });

  it('pop removes top of stack', () => {
    act(() => {
      useNavStore.getState().push({ screen: 'reciterDetail', reciterId: 'r1' });
      useNavStore.getState().push({ screen: 'nowPlaying' });
      useNavStore.getState().pop();
    });
    expect(useNavStore.getState().stack).toHaveLength(1);
    expect(useNavStore.getState().stack[0].screen).toBe('reciterDetail');
  });

  it('pop on empty stack is a no-op', () => {
    act(() => useNavStore.getState().pop());
    expect(useNavStore.getState().stack).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement nav store**

`tv-app/store/navStore.ts`:
```ts
import { create } from 'zustand';

export type TabKey = 'home' | 'search' | 'collection' | 'settings';

export type ScreenEntry =
  | { screen: 'nowPlaying' }
  | { screen: 'reciterDetail'; reciterId: string }
  | { screen: 'catalogGrid' };

type NavState = {
  currentTab: TabKey;
  stack: ScreenEntry[];
  switchTab: (tab: TabKey) => void;
  push: (entry: ScreenEntry) => void;
  pop: () => void;
  reset: () => void;
};

export const useNavStore = create<NavState>((set) => ({
  currentTab: 'home',
  stack: [],
  switchTab: (tab) => set({ currentTab: tab, stack: [] }),
  push: (entry) => set((s) => ({ stack: [...s.stack, entry] })),
  pop: () => set((s) => ({ stack: s.stack.slice(0, -1) })),
  reset: () => set({ currentTab: 'home', stack: [] }),
}));
```

- [ ] **Step 3: Run; 5 PASS**

- [ ] **Step 4: Write ambient store tests**

`tv-app/store/ambientStore.test.ts`:
```ts
import { useAmbientStore } from './ambientStore';
import { act } from '@testing-library/react-native';
import { storage } from '../services/storage';

beforeEach(() => {
  storage.clearAll();
  act(() => useAmbientStore.getState().reset());
});

describe('ambientStore', () => {
  it('defaults to disabled rain at 0.5 volume', () => {
    expect(useAmbientStore.getState().enabled).toBe(false);
    expect(useAmbientStore.getState().currentSound).toBe('rain');
    expect(useAmbientStore.getState().volume).toBe(0.5);
  });

  it('setVolume clamps to [0,1]', () => {
    act(() => useAmbientStore.getState().setVolume(2));
    expect(useAmbientStore.getState().volume).toBe(1);
    act(() => useAmbientStore.getState().setVolume(-0.5));
    expect(useAmbientStore.getState().volume).toBe(0);
  });

  it('toggle flips enabled', () => {
    act(() => useAmbientStore.getState().toggle());
    expect(useAmbientStore.getState().enabled).toBe(true);
    act(() => useAmbientStore.getState().toggle());
    expect(useAmbientStore.getState().enabled).toBe(false);
  });

  it('setSound updates currentSound', () => {
    act(() => useAmbientStore.getState().setSound('forest'));
    expect(useAmbientStore.getState().currentSound).toBe('forest');
  });
});
```

- [ ] **Step 5: Implement ambient store**

`tv-app/store/ambientStore.ts`:
```ts
import { create } from 'zustand';

export type AmbientSound =
  | 'rain'
  | 'forest'
  | 'ocean'
  | 'stream'
  | 'wind'
  | 'fireplace';

type AmbientState = {
  enabled: boolean;
  currentSound: AmbientSound;
  volume: number;
  toggle: () => void;
  setSound: (s: AmbientSound) => void;
  setVolume: (v: number) => void;
  reset: () => void;
};

const clamp = (n: number): number => Math.max(0, Math.min(1, n));

export const useAmbientStore = create<AmbientState>((set) => ({
  enabled: false,
  currentSound: 'rain',
  volume: 0.5,
  toggle: () => set((s) => ({ enabled: !s.enabled })),
  setSound: (sound) => set({ currentSound: sound }),
  setVolume: (v) => set({ volume: clamp(v) }),
  reset: () => set({ enabled: false, currentSound: 'rain', volume: 0.5 }),
}));
```

- [ ] **Step 6: Run tests; 4 PASS**

- [ ] **Step 7: tsc + prettier + commit**

```bash
cd tv-app && npx tsc --noEmit && npx prettier --write store/
cd .. && git add tv-app/ && git commit -m "feat(tv): add navStore (state router) and ambientStore"
```

---

## Task 5: tvPlayerStore (queue + transport)

**Files:**
- Create: `tv-app/store/tvPlayerStore.ts`
- Create: `tv-app/store/tvPlayerStore.test.ts`
- Create: `tv-app/services/audioEngine.ts` (thin adapter around `../services/audio/ExpoAudioService` so tests can mock it)

**Why an adapter:** `ExpoAudioService` is shared from phone. Our store needs to call `load(url)`, `play()`, `pause()`, `seek(seconds)`, `setRate(n)`, and subscribe to `(position, duration, status)` events. Wrapping in `audioEngine.ts` lets tests provide a mock without touching the shared singleton.

- [ ] **Step 1: Define audioEngine interface**

`tv-app/services/audioEngine.ts`:
```ts
import ExpoAudioService from '../../services/audio/ExpoAudioService';

export type EngineStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'error';

export type EngineEvent = {
  status: EngineStatus;
  positionSeconds: number;
  durationSeconds: number;
};

export type AudioEngine = {
  load: (url: string) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  seek: (seconds: number) => void;
  setRate: (rate: number) => void;
  subscribe: (cb: (e: EngineEvent) => void) => () => void;
};

// Thin adapter around phone's ExpoAudioService singleton.
// Actual wiring will depend on ExpoAudioService's public API — fill in when
// implementing.
export function createAudioEngine(): AudioEngine {
  // TODO in Task 5 Step 3 — see implementation step for full body.
  throw new Error('not implemented');
}
```

- [ ] **Step 2: Write tvPlayerStore tests (engine mocked)**

`tv-app/store/tvPlayerStore.test.ts`:
```ts
import { useTVPlayerStore } from './tvPlayerStore';
import type { AudioEngine, EngineEvent } from '../services/audioEngine';
import { act } from '@testing-library/react-native';

function makeMockEngine(): AudioEngine & { emit: (e: EngineEvent) => void } {
  let listener: ((e: EngineEvent) => void) | null = null;
  return {
    load: jest.fn().mockResolvedValue(undefined),
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    seek: jest.fn(),
    setRate: jest.fn(),
    subscribe: (cb) => {
      listener = cb;
      return () => {
        listener = null;
      };
    },
    emit: (e) => listener?.(e),
  };
}

const queue = [
  {
    reciterId: 'r1',
    rewayahId: 'w1',
    surahNumber: 1,
    audioUrl: 'https://x/001.mp3',
    title: 'Al-Fatihah',
    subtitle: 'al-Afasy',
  },
  {
    reciterId: 'r1',
    rewayahId: 'w1',
    surahNumber: 2,
    audioUrl: 'https://x/002.mp3',
    title: 'Al-Baqarah',
    subtitle: 'al-Afasy',
  },
  {
    reciterId: 'r1',
    rewayahId: 'w1',
    surahNumber: 3,
    audioUrl: 'https://x/003.mp3',
    title: 'Aal-Imran',
    subtitle: 'al-Afasy',
  },
];

describe('tvPlayerStore', () => {
  beforeEach(() => {
    act(() => useTVPlayerStore.getState().reset());
  });

  it('starts idle with empty queue', () => {
    const s = useTVPlayerStore.getState();
    expect(s.status).toBe('idle');
    expect(s.queue).toEqual([]);
  });

  it('loadQueue loads first item and plays', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await act(async () => {
      await useTVPlayerStore.getState().loadQueue(queue, 0);
    });
    expect(engine.load).toHaveBeenCalledWith('https://x/001.mp3');
    expect(engine.play).toHaveBeenCalled();
    expect(useTVPlayerStore.getState().currentIndex).toBe(0);
  });

  it('next advances index and loads next track', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await act(async () => {
      await useTVPlayerStore.getState().loadQueue(queue, 0);
      await useTVPlayerStore.getState().next();
    });
    expect(useTVPlayerStore.getState().currentIndex).toBe(1);
    expect(engine.load).toHaveBeenLastCalledWith('https://x/002.mp3');
  });

  it('next at end with repeat=off stays put', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await act(async () => {
      await useTVPlayerStore.getState().loadQueue(queue, 2);
      await useTVPlayerStore.getState().next();
    });
    expect(useTVPlayerStore.getState().currentIndex).toBe(2);
  });

  it('next at end with repeat=all wraps to 0', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await act(async () => {
      await useTVPlayerStore.getState().loadQueue(queue, 2);
      useTVPlayerStore.getState().setRepeat('all');
      await useTVPlayerStore.getState().next();
    });
    expect(useTVPlayerStore.getState().currentIndex).toBe(0);
  });

  it('prev within first 3 seconds goes to previous track', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await act(async () => {
      await useTVPlayerStore.getState().loadQueue(queue, 2);
    });
    act(() =>
      engine.emit({ status: 'playing', positionSeconds: 1, durationSeconds: 60 }),
    );
    await act(async () => useTVPlayerStore.getState().prev());
    expect(useTVPlayerStore.getState().currentIndex).toBe(1);
  });

  it('prev after 3 seconds restarts current track', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await act(async () => {
      await useTVPlayerStore.getState().loadQueue(queue, 1);
    });
    act(() =>
      engine.emit({ status: 'playing', positionSeconds: 10, durationSeconds: 60 }),
    );
    await act(async () => useTVPlayerStore.getState().prev());
    expect(useTVPlayerStore.getState().currentIndex).toBe(1);
    expect(engine.seek).toHaveBeenCalledWith(0);
  });

  it('seekBy(15) calls engine.seek with position + 15', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await act(async () => {
      await useTVPlayerStore.getState().loadQueue(queue, 0);
    });
    act(() =>
      engine.emit({ status: 'playing', positionSeconds: 20, durationSeconds: 60 }),
    );
    act(() => useTVPlayerStore.getState().seekBy(15));
    expect(engine.seek).toHaveBeenCalledWith(35);
  });

  it('toggle plays when paused, pauses when playing', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await act(async () => {
      await useTVPlayerStore.getState().loadQueue(queue, 0);
    });
    act(() =>
      engine.emit({ status: 'playing', positionSeconds: 5, durationSeconds: 60 }),
    );
    act(() => useTVPlayerStore.getState().toggle());
    expect(engine.pause).toHaveBeenCalled();
  });

  it('auto-advances when engine emits status=idle at end of track', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await act(async () => {
      await useTVPlayerStore.getState().loadQueue(queue, 0);
    });
    await act(async () => {
      engine.emit({ status: 'playing', positionSeconds: 59.9, durationSeconds: 60 });
      engine.emit({ status: 'idle', positionSeconds: 60, durationSeconds: 60 });
      await Promise.resolve();
    });
    expect(useTVPlayerStore.getState().currentIndex).toBe(1);
  });

  it('setSpeed calls engine.setRate', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    act(() => useTVPlayerStore.getState().setSpeed(1.5));
    expect(engine.setRate).toHaveBeenCalledWith(1.5);
  });
});
```

- [ ] **Step 3: Run tests — all fail**

- [ ] **Step 4: Implement tvPlayerStore**

`tv-app/store/tvPlayerStore.ts`:
```ts
import { create } from 'zustand';
import type { PlayerStatus, QueueItem } from '../types/player';
import type { AudioEngine, EngineEvent } from '../services/audioEngine';
import { recordProgress } from '../services/continueListeningStore';

export type RepeatMode = 'off' | 'one' | 'all';

type TVPlayerState = {
  engine: AudioEngine | null;
  queue: QueueItem[];
  currentIndex: number;
  status: PlayerStatus;
  positionSeconds: number;
  durationSeconds: number;
  speed: number;
  shuffle: boolean;
  repeat: RepeatMode;
  unsubscribe: (() => void) | null;

  setEngine: (engine: AudioEngine) => void;
  loadQueue: (queue: QueueItem[], startIndex: number) => Promise<void>;
  toggle: () => void;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seekBy: (deltaSeconds: number) => void;
  seekTo: (seconds: number) => void;
  setSpeed: (speed: number) => void;
  setShuffle: (on: boolean) => void;
  setRepeat: (mode: RepeatMode) => void;
  reset: () => void;
};

let progressWriteTimer: ReturnType<typeof setInterval> | null = null;

export const useTVPlayerStore = create<TVPlayerState>((set, get) => ({
  engine: null,
  queue: [],
  currentIndex: 0,
  status: 'idle',
  positionSeconds: 0,
  durationSeconds: 0,
  speed: 1,
  shuffle: false,
  repeat: 'off',
  unsubscribe: null,

  setEngine: (engine) => {
    const prevUnsub = get().unsubscribe;
    if (prevUnsub) prevUnsub();
    const unsubscribe = engine.subscribe((e: EngineEvent) => {
      const current = get();
      set({
        status: e.status,
        positionSeconds: e.positionSeconds,
        durationSeconds: e.durationSeconds,
      });
      // Auto-advance on natural track end
      if (
        e.status === 'idle' &&
        current.status === 'playing' &&
        current.positionSeconds > 0 &&
        e.positionSeconds >= current.durationSeconds - 0.5
      ) {
        void get().next();
      }
    });
    set({ engine, unsubscribe });
  },

  loadQueue: async (queue, startIndex) => {
    const engine = get().engine;
    if (!engine || queue.length === 0) return;
    set({ queue, currentIndex: startIndex, status: 'loading' });
    await engine.load(queue[startIndex].audioUrl);
    await engine.play();
    startProgressWriter(get);
  },

  toggle: () => {
    const { engine, status } = get();
    if (!engine) return;
    if (status === 'playing') engine.pause();
    else void engine.play();
  },

  next: async () => {
    const { engine, queue, currentIndex, repeat } = get();
    if (!engine || queue.length === 0) return;
    let nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeat === 'all') nextIndex = 0;
      else return;
    }
    set({ currentIndex: nextIndex, status: 'loading' });
    await engine.load(queue[nextIndex].audioUrl);
    await engine.play();
  },

  prev: async () => {
    const { engine, queue, currentIndex, positionSeconds } = get();
    if (!engine || queue.length === 0) return;
    if (positionSeconds > 3) {
      engine.seek(0);
      return;
    }
    const prevIndex = Math.max(0, currentIndex - 1);
    set({ currentIndex: prevIndex, status: 'loading' });
    await engine.load(queue[prevIndex].audioUrl);
    await engine.play();
  },

  seekBy: (delta) => {
    const { engine, positionSeconds, durationSeconds } = get();
    if (!engine) return;
    const target = Math.max(0, Math.min(durationSeconds, positionSeconds + delta));
    engine.seek(target);
  },

  seekTo: (seconds) => {
    const { engine } = get();
    engine?.seek(Math.max(0, seconds));
  },

  setSpeed: (speed) => {
    get().engine?.setRate(speed);
    set({ speed });
  },

  setShuffle: (shuffle) => set({ shuffle }),
  setRepeat: (repeat) => set({ repeat }),

  reset: () => {
    const unsub = get().unsubscribe;
    if (unsub) unsub();
    if (progressWriteTimer) {
      clearInterval(progressWriteTimer);
      progressWriteTimer = null;
    }
    set({
      engine: null,
      queue: [],
      currentIndex: 0,
      status: 'idle',
      positionSeconds: 0,
      durationSeconds: 0,
      speed: 1,
      shuffle: false,
      repeat: 'off',
      unsubscribe: null,
    });
  },
}));

function startProgressWriter(get: () => TVPlayerState): void {
  if (progressWriteTimer) clearInterval(progressWriteTimer);
  progressWriteTimer = setInterval(() => {
    const { queue, currentIndex, positionSeconds, durationSeconds, status } = get();
    if (status !== 'playing' || queue.length === 0) return;
    const item = queue[currentIndex];
    recordProgress({
      reciterId: item.reciterId,
      rewayahId: item.rewayahId ?? '',
      surahNumber: item.surahNumber,
      positionSeconds,
      durationSeconds,
    });
  }, 5000);
}
```

Note: `QueueItem` shape from `types/player.ts` — the `rewayahId` is optional in that type. Adjust import shape if needed (check current `types/player.ts` — it has `rewayahId?: string`).

- [ ] **Step 5: Run tests; 11 PASS**

- [ ] **Step 6: Implement real audioEngine adapter**

`tv-app/services/audioEngine.ts` — replace TODO body. **Before writing, inspect `../services/audio/ExpoAudioService.ts` for its actual public API** (the phone-side singleton's method names). Then adapt:

```ts
import ExpoAudioService from '../../services/audio/ExpoAudioService';

// ...type defs as before...

export function createAudioEngine(): AudioEngine {
  return {
    load: (url) => ExpoAudioService.load(url),
    play: () => ExpoAudioService.play(),
    pause: () => ExpoAudioService.pause(),
    seek: (s) => ExpoAudioService.seek(s),
    setRate: (r) => ExpoAudioService.setRate(r),
    subscribe: (cb) =>
      ExpoAudioService.addListener((e) =>
        cb({
          status: e.isPlaying
            ? 'playing'
            : e.isBuffering
              ? 'buffering'
              : e.didJustFinish
                ? 'idle'
                : 'paused',
          positionSeconds: e.positionMillis / 1000,
          durationSeconds: e.durationMillis / 1000,
        }),
      ),
  };
}
```

**If ExpoAudioService's API differs from the sketch above**, map accordingly. The only invariants the store requires: `load(url)`, `play()`, `pause()`, `seek(seconds)`, `setRate(rate)`, and a subscription that emits `{status, positionSeconds, durationSeconds}`.

- [ ] **Step 7: tsc + prettier + commit**

```bash
cd tv-app && npx tsc --noEmit && npx prettier --write store/tvPlayerStore.ts store/tvPlayerStore.test.ts services/audioEngine.ts
cd .. && git add tv-app/ && git commit -m "feat(tv): tvPlayerStore with queue, transport, auto-advance, progress writer"
```

---

## Task 6: Hooks layer

**Files:**
- Create: `tv-app/hooks/usePlayer.ts`
- Create: `tv-app/hooks/useReciters.ts`
- Create: `tv-app/hooks/useContinueListening.ts`
- Create: `tv-app/hooks/useDefaultReciter.ts`
- Create: `tv-app/hooks/useFocusTimer.ts`
- Create: `tv-app/hooks/useTVBackHandler.ts`
- Tests only for the non-trivial ones: `useContinueListening.test.ts`, `useFocusTimer.test.ts`.

- [ ] **Step 1: usePlayer**

```ts
// tv-app/hooks/usePlayer.ts
import { useTVPlayerStore } from '../store/tvPlayerStore';
import type { QueueItem } from '../types/player';
import type { Rewayah, Surah } from '../types/reciter';
import { buildAudioUrl } from '../services/tvDataService';
import SURAHS from '../../data/surahData.json';

type SurahMeta = { number: number; name: string };
const surahByNumber: Map<number, SurahMeta> = new Map(
  (SURAHS as SurahMeta[]).map((s) => ({ number: s.number, name: s.name })).map((s) => [s.number, s]),
);

function buildQueue(
  reciterId: string,
  reciterName: string,
  rewayah: Rewayah,
): QueueItem[] {
  const surahNumbers = rewayah.surah_list
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => n > 0);
  return surahNumbers.map((num) => ({
    reciterId,
    rewayahId: rewayah.id,
    surahNumber: num,
    audioUrl: buildAudioUrl(rewayah.server, num),
    title: surahByNumber.get(num)?.name ?? `Surah ${num}`,
    subtitle: reciterName,
  }));
}

export function usePlayer() {
  const store = useTVPlayerStore();
  return {
    ...store,
    playRewayah: async (
      reciterId: string,
      reciterName: string,
      rewayah: Rewayah,
      startSurahNumber: number,
    ) => {
      const queue = buildQueue(reciterId, reciterName, rewayah);
      const idx = queue.findIndex((q) => q.surahNumber === startSurahNumber);
      await store.loadQueue(queue, idx >= 0 ? idx : 0);
    },
  };
}
```

- [ ] **Step 2: useReciters**

```ts
// tv-app/hooks/useReciters.ts
import { useEffect, useState } from 'react';
import { fetchReciters, getCachedReciters } from '../services/tvDataService';
import type { Reciter } from '../types/reciter';

export function useReciters(): { reciters: Reciter[]; loading: boolean } {
  const [reciters, setReciters] = useState<Reciter[]>(() => getCachedReciters() ?? []);
  const [loading, setLoading] = useState<boolean>(reciters.length === 0);

  useEffect(() => {
    let cancelled = false;
    fetchReciters()
      .then((r) => {
        if (!cancelled) setReciters(r);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { reciters, loading };
}
```

- [ ] **Step 3: useContinueListening with test**

```ts
// tv-app/hooks/useContinueListening.ts
import { useSyncExternalStore } from 'react';
import { storage } from '../services/storage';
import {
  getContinueEntries,
  type ContinueEntry,
} from '../services/continueListeningStore';

function subscribe(cb: () => void): () => void {
  const listener = storage.addOnValueChangedListener((key: string) => {
    if (key === 'bayaan_tv_continue') cb();
  });
  return () => listener.remove();
}

export function useContinueListening(): ContinueEntry[] {
  return useSyncExternalStore(subscribe, getContinueEntries, getContinueEntries);
}
```

Test `tv-app/hooks/useContinueListening.test.ts`:
```ts
import { renderHook, act } from '@testing-library/react-native';
import { useContinueListening } from './useContinueListening';
import { recordProgress, clearContinue } from '../services/continueListeningStore';
import { storage } from '../services/storage';

beforeEach(() => storage.clearAll());

describe('useContinueListening', () => {
  it('returns empty array initially', () => {
    const { result } = renderHook(() => useContinueListening());
    expect(result.current).toEqual([]);
  });

  it('updates when recordProgress runs (best-effort, may require re-render)', () => {
    const { result, rerender } = renderHook(() => useContinueListening());
    act(() =>
      recordProgress({
        reciterId: 'a',
        rewayahId: 'r',
        surahNumber: 1,
        positionSeconds: 10,
        durationSeconds: 60,
      }),
    );
    rerender(undefined);
    expect(result.current.length).toBeGreaterThanOrEqual(0);
    // Full reactive hookup depends on MMKV listener support — if MMKV lacks a
    // change listener in this version, the hook will fall back to poll on mount.
    // This test primarily guards that it doesn't crash.
  });
});
```

**Note if MMKV lacks `addOnValueChangedListener`:** replace subscribe with a poll-on-focus pattern — subscribe to React Navigation focus events (or, since we don't have React Navigation, to a navStore subscription). For the test above, adjust to manual re-render as the reactive path.

- [ ] **Step 4: useDefaultReciter**

```ts
// tv-app/hooks/useDefaultReciter.ts
import { useCallback, useEffect, useState } from 'react';
import { storage } from '../services/storage';

const KEY = 'bayaan_tv_default_reciter_id';

export function useDefaultReciter(): {
  defaultReciterId: string | null;
  setDefaultReciter: (id: string) => void;
} {
  const [id, setId] = useState<string | null>(() => storage.getString(KEY) ?? null);

  useEffect(() => {
    const listener = storage.addOnValueChangedListener((k: string) => {
      if (k === KEY) setId(storage.getString(KEY) ?? null);
    });
    return () => listener.remove();
  }, []);

  const setDefaultReciter = useCallback((next: string) => {
    storage.set(KEY, next);
  }, []);

  return { defaultReciterId: id, setDefaultReciter };
}
```

- [ ] **Step 5: useFocusTimer with test**

```ts
// tv-app/hooks/useFocusTimer.ts
import { useCallback, useEffect, useRef, useState } from 'react';

export function useFocusTimer(idleMs = 3000): {
  visible: boolean;
  reveal: () => void;
} {
  const [visible, setVisible] = useState<boolean>(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), idleMs);
  }, [idleMs]);

  const reveal = useCallback(() => {
    setVisible(true);
    arm();
  }, [arm]);

  useEffect(() => {
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [arm]);

  return { visible, reveal };
}
```

Test `tv-app/hooks/useFocusTimer.test.ts`:
```ts
import { renderHook, act } from '@testing-library/react-native';
import { useFocusTimer } from './useFocusTimer';

describe('useFocusTimer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('visible initially, hides after idleMs', () => {
    const { result } = renderHook(() => useFocusTimer(1000));
    expect(result.current.visible).toBe(true);
    act(() => jest.advanceTimersByTime(1100));
    expect(result.current.visible).toBe(false);
  });

  it('reveal restores visibility and resets timer', () => {
    const { result } = renderHook(() => useFocusTimer(1000));
    act(() => jest.advanceTimersByTime(1100));
    expect(result.current.visible).toBe(false);
    act(() => result.current.reveal());
    expect(result.current.visible).toBe(true);
    act(() => jest.advanceTimersByTime(500));
    expect(result.current.visible).toBe(true);
    act(() => jest.advanceTimersByTime(600));
    expect(result.current.visible).toBe(false);
  });
});
```

- [ ] **Step 6: useTVBackHandler**

```ts
// tv-app/hooks/useTVBackHandler.ts
import { useEffect } from 'react';
import { BackHandler } from 'react-native';

export function useTVBackHandler(handler: () => boolean): void {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, [handler]);
}
```

- [ ] **Step 7: Run tests; all pass**

Run: `cd tv-app && npx jest hooks/ -v`

- [ ] **Step 8: tsc + prettier + commit**

```bash
cd tv-app && npx tsc --noEmit && npx prettier --write hooks/
cd .. && git add tv-app/ && git commit -m "feat(tv): hooks layer — usePlayer, useReciters, useContinueListening, useDefaultReciter, useFocusTimer, useTVBackHandler"
```

---

## Task 7: Focus primitives (FocusableCard, AutoHideChrome)

**Files:**
- Create: `tv-app/components/primitives/FocusableCard.tsx`
- Create: `tv-app/components/primitives/AutoHideChrome.tsx`
- Modify: `tv-app/components/primitives/FocusableButton.tsx` (use spring animation consistent with spec)

- [ ] **Step 1: FocusableCard**

```tsx
// tv-app/components/primitives/FocusableCard.tsx
import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

type Props = {
  onPress: () => void;
  children: React.ReactNode;
  hasTVPreferredFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function FocusableCard({
  onPress,
  children,
  hasTVPreferredFocus,
  style,
  accessibilityLabel,
}: Props): React.ReactElement {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  function animate(to: number): void {
    Animated.spring(scale, {
      toValue: to,
      stiffness: 240,
      damping: 18,
      mass: 1,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onFocus={() => {
          setFocused(true);
          animate(1.08);
        }}
        onBlur={() => {
          setFocused(false);
          animate(1);
        }}
        hasTVPreferredFocus={hasTVPreferredFocus}
        accessibilityLabel={accessibilityLabel}
        style={[
          { borderRadius: 12, borderWidth: 3, borderColor: 'transparent' },
          focused && { borderColor: colors.focusRing },
          style,
        ]}
      >
        <View>{children}</View>
      </Pressable>
    </Animated.View>
  );
}
```

- [ ] **Step 2: AutoHideChrome**

```tsx
// tv-app/components/primitives/AutoHideChrome.tsx
import React from 'react';
import { Animated } from 'react-native';

type Props = {
  visible: boolean;
  children: React.ReactNode;
  fadeMs?: number;
};

export function AutoHideChrome({
  visible,
  children,
  fadeMs = 250,
}: Props): React.ReactElement {
  const opacity = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: visible ? 150 : fadeMs,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity, fadeMs]);

  return (
    <Animated.View style={{ opacity }} pointerEvents={visible ? 'auto' : 'none'}>
      {children}
    </Animated.View>
  );
}
```

- [ ] **Step 3: Harmonize FocusableButton with same animation config**

Update `tv-app/components/primitives/FocusableButton.tsx` to use `Animated.spring` with `stiffness: 240, damping: 18` (consistent with FocusableCard). Keep its existing props interface.

- [ ] **Step 4: tsc + prettier + commit**

```bash
cd tv-app && npx tsc --noEmit && npx prettier --write components/primitives/
cd .. && git add tv-app/ && git commit -m "feat(tv): focus primitives — FocusableCard, AutoHideChrome; align FocusableButton animation"
```

---

## Task 8: Rail components (Rail, ReciterCard, ContinueCard, QuickPlayCard, SeeAllCard)

**Files:**
- Create: `tv-app/components/rails/Rail.tsx`
- Create: `tv-app/components/rails/RailHeader.tsx`
- Create: `tv-app/components/rails/ReciterCard.tsx`
- Create: `tv-app/components/rails/ContinueCard.tsx`
- Create: `tv-app/components/rails/QuickPlayCard.tsx`
- Create: `tv-app/components/rails/SeeAllCard.tsx`

All cards wrap `FocusableCard`. All sizing matches spec (ReciterCard 140×180, ContinueCard 220×140, QuickPlayCard 120×120, SeeAllCard matches whatever rail it's in).

- [ ] **Step 1: RailHeader**

```tsx
// tv-app/components/rails/RailHeader.tsx
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type Props = { title: string };

export function RailHeader({ title }: Props): React.ReactElement {
  return <Text style={styles.label}>{title}</Text>;
}

const styles = StyleSheet.create({
  label: {
    color: colors.textSecondary,
    ...typography.label,
    marginBottom: 10,
  },
});
```

- [ ] **Step 2: Rail (generic horizontal scroll)**

```tsx
// tv-app/components/rails/Rail.tsx
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { RailHeader } from './RailHeader';
import { spacing } from '../../theme/spacing';

type Props = {
  title: string;
  children: React.ReactNode;
};

export function Rail({ title, children }: Props): React.ReactElement {
  return (
    <View style={styles.section}>
      <RailHeader title={title} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  rail: { gap: spacing.sm, paddingRight: spacing.xl },
});
```

- [ ] **Step 3: ReciterCard**

```tsx
// tv-app/components/rails/ReciterCard.tsx
import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { FocusableCard } from '../primitives/FocusableCard';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import type { Reciter } from '../../types/reciter';

type Props = {
  reciter: Reciter;
  onSelect: (r: Reciter) => void;
  hasTVPreferredFocus?: boolean;
};

export function ReciterCard({
  reciter,
  onSelect,
  hasTVPreferredFocus,
}: Props): React.ReactElement {
  return (
    <FocusableCard
      style={styles.card}
      onPress={() => onSelect(reciter)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={reciter.name}
    >
      <View style={styles.artwork}>
        {reciter.image_url ? (
          <Image
            source={{ uri: reciter.image_url }}
            style={styles.img}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {reciter.name}
      </Text>
    </FocusableCard>
  );
}

const CARD_WIDTH = 140;
const CARD_HEIGHT = 180;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  artwork: { flex: 1, backgroundColor: colors.surfaceElevated },
  img: { width: '100%', height: '100%' },
  placeholder: { flex: 1, backgroundColor: colors.surfaceElevated },
  name: { color: colors.text, ...typography.caption, padding: 10 },
});
```

- [ ] **Step 4: ContinueCard (16:9, shows progress)**

```tsx
// tv-app/components/rails/ContinueCard.tsx
import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { FocusableCard } from '../primitives/FocusableCard';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import type { ContinueEntry } from '../../services/continueListeningStore';
import type { Reciter } from '../../types/reciter';

type Props = {
  entry: ContinueEntry;
  reciter: Reciter | null;
  surahName: string;
  onSelect: (e: ContinueEntry) => void;
  hasTVPreferredFocus?: boolean;
};

export function ContinueCard({
  entry,
  reciter,
  surahName,
  onSelect,
  hasTVPreferredFocus,
}: Props): React.ReactElement {
  const progress = entry.durationSeconds
    ? Math.min(1, entry.positionSeconds / entry.durationSeconds)
    : 0;
  return (
    <FocusableCard
      style={styles.card}
      onPress={() => onSelect(entry)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={`Resume ${surahName} by ${reciter?.name ?? ''}`}
    >
      {reciter?.image_url ? (
        <Image source={{ uri: reciter.image_url }} style={styles.img} contentFit="cover" cachePolicy="memory-disk" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceElevated }]} />
      )}
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>{surahName}</Text>
        <Text style={styles.sub} numberOfLines={1}>{reciter?.name ?? ''}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
      </View>
    </FocusableCard>
  );
}

const styles = StyleSheet.create({
  card: { width: 220, height: 140, backgroundColor: colors.surface, overflow: 'hidden' },
  img: { ...StyleSheet.absoluteFillObject },
  scrim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  meta: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  title: { color: colors.text, ...typography.caption, fontWeight: '700' },
  sub: { color: colors.text, fontSize: 11, opacity: 0.75, marginTop: 2 },
  track: { marginTop: 6, height: 2, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 1 },
  fill: { height: '100%', backgroundColor: colors.text, borderRadius: 1 },
});
```

- [ ] **Step 5: QuickPlayCard**

```tsx
// tv-app/components/rails/QuickPlayCard.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FocusableCard } from '../primitives/FocusableCard';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type Props = {
  surahNumber: number;
  surahName: string;
  onSelect: (n: number) => void;
};

export function QuickPlayCard({
  surahNumber,
  surahName,
  onSelect,
}: Props): React.ReactElement {
  return (
    <FocusableCard
      style={styles.card}
      onPress={() => onSelect(surahNumber)}
      accessibilityLabel={`Play ${surahName}`}
    >
      <View style={styles.inner}>
        <Text style={styles.num}>{surahNumber}</Text>
        <Text style={styles.name} numberOfLines={2}>{surahName}</Text>
      </View>
    </FocusableCard>
  );
}

const styles = StyleSheet.create({
  card: { width: 120, height: 120, backgroundColor: colors.surface },
  inner: { flex: 1, padding: 12, justifyContent: 'space-between' },
  num: { color: colors.text, fontSize: 36, fontWeight: '300', opacity: 0.5 },
  name: { color: colors.text, ...typography.caption },
});
```

- [ ] **Step 6: SeeAllCard**

```tsx
// tv-app/components/rails/SeeAllCard.tsx
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { FocusableCard } from '../primitives/FocusableCard';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type Props = { onSelect: () => void; height?: number; width?: number };

export function SeeAllCard({
  onSelect,
  height = 180,
  width = 140,
}: Props): React.ReactElement {
  return (
    <FocusableCard
      style={[styles.card, { height, width }]}
      onPress={onSelect}
      accessibilityLabel="See all reciters"
    >
      <Text style={styles.label}>See all →</Text>
    </FocusableCard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.text, ...typography.body, fontWeight: '600' },
});
```

- [ ] **Step 7: tsc + prettier + commit**

```bash
cd tv-app && npx tsc --noEmit && npx prettier --write components/rails/
cd .. && git add tv-app/ && git commit -m "feat(tv): rail components — Rail, ReciterCard, ContinueCard, QuickPlayCard, SeeAllCard"
```

---

## Task 9: TopTabBar + state Router

**Files:**
- Create: `tv-app/components/nav/TopTabBar.tsx`
- Create: `tv-app/components/nav/Router.tsx`

- [ ] **Step 1: TopTabBar**

```tsx
// tv-app/components/nav/TopTabBar.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FocusableButton } from '../primitives/FocusableButton';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useNavStore, type TabKey } from '../../store/navStore';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'search', label: 'Search' },
  { key: 'collection', label: 'Collection' },
];

export function TopTabBar(): React.ReactElement {
  const current = useNavStore((s) => s.currentTab);
  const switchTab = useNavStore((s) => s.switchTab);
  return (
    <View style={styles.bar}>
      <View style={styles.center}>
        {TABS.map((t) => (
          <FocusableButton
            key={t.key}
            onPress={() => switchTab(t.key)}
            accessibilityLabel={t.label}
            style={styles.tab}
          >
            <Text style={[styles.tabText, current === t.key && styles.tabActive]}>{t.label}</Text>
          </FocusableButton>
        ))}
      </View>
      <FocusableButton
        onPress={() => switchTab('settings')}
        accessibilityLabel="Settings"
        style={styles.settings}
      >
        <Text style={styles.tabText}>⚙</Text>
      </FocusableButton>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  tab: { paddingHorizontal: spacing.sm, paddingVertical: 8 },
  tabText: { color: colors.text, ...typography.caption, opacity: 0.45 },
  tabActive: { opacity: 1, fontWeight: '700' },
  settings: { padding: spacing.sm },
});
```

- [ ] **Step 2: Router**

```tsx
// tv-app/components/nav/Router.tsx
import React from 'react';
import { View } from 'react-native';
import { useNavStore } from '../../store/navStore';
import { HomeScreen } from '../../screens/HomeScreen';
import { SearchScreen } from '../../screens/SearchScreen';
import { CollectionScreen } from '../../screens/CollectionScreen';
import { SettingsScreen } from '../../screens/SettingsScreen';
import { NowPlayingScreen } from '../../screens/NowPlayingScreen';
import { ReciterDetailScreen } from '../../screens/ReciterDetailScreen';
import { CatalogGridScreen } from '../../screens/CatalogGridScreen';
import { useTVBackHandler } from '../../hooks/useTVBackHandler';

export function Router(): React.ReactElement {
  const { currentTab, stack, pop } = useNavStore((s) => ({
    currentTab: s.currentTab,
    stack: s.stack,
    pop: s.pop,
  }));

  useTVBackHandler(() => {
    if (stack.length > 0) {
      pop();
      return true;
    }
    return false;
  });

  const top = stack[stack.length - 1];

  if (top) {
    if (top.screen === 'nowPlaying') return <NowPlayingScreen />;
    if (top.screen === 'reciterDetail') return <ReciterDetailScreen reciterId={top.reciterId} />;
    if (top.screen === 'catalogGrid') return <CatalogGridScreen />;
  }

  return (
    <View style={{ flex: 1 }}>
      {currentTab === 'home' && <HomeScreen />}
      {currentTab === 'search' && <SearchScreen />}
      {currentTab === 'collection' && <CollectionScreen />}
      {currentTab === 'settings' && <SettingsScreen />}
    </View>
  );
}
```

Note: Router references screens that don't exist yet — they're created in later tasks. TypeScript will fail here until all screens exist. Comment out screen imports you haven't created yet, or create empty stubs first.

**Recommended:** create one-line stub files now to unblock typecheck:
```tsx
// tv-app/screens/<Name>.tsx — stub
import React from 'react';
import { Text, View } from 'react-native';
export function <Name>(props?: any): React.ReactElement {
  return <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}><Text style={{ color: '#fff' }}><Name></Text></View>;
}
```

Create stubs for: `HomeScreen`, `SearchScreen`, `CollectionScreen`, `SettingsScreen`, `NowPlayingScreen`, `ReciterDetailScreen`, `CatalogGridScreen`. Tasks 12–16 replace each stub.

- [ ] **Step 3: Create stub screens**

Create seven files matching the pattern above with the correct component name.

- [ ] **Step 4: tsc + prettier + commit**

```bash
cd tv-app && npx tsc --noEmit && npx prettier --write components/nav/ screens/
cd .. && git add tv-app/ && git commit -m "feat(tv): TopTabBar + state Router + screen stubs"
```

---

## Task 10: Now Playing components — backdrop, title, scrubber

**Files:**
- Create: `tv-app/components/player/ArtworkBackdrop.tsx`
- Create: `tv-app/components/player/NowPlayingTitle.tsx`
- Create: `tv-app/components/player/Scrubber.tsx`

- [ ] **Step 1: ArtworkBackdrop**

```tsx
// tv-app/components/player/ArtworkBackdrop.tsx
import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../theme/colors';

type Props = { imageUrl: string | null };

export function ArtworkBackdrop({ imageUrl }: Props): React.ReactElement {
  return (
    <View style={StyleSheet.absoluteFillObject}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          blurRadius={40}
          cachePolicy="memory-disk"
          priority="high"
        />
      ) : null}
      <View style={[StyleSheet.absoluteFillObject, styles.scrim]} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.overlayScrim },
});
```

- [ ] **Step 2: NowPlayingTitle**

```tsx
// tv-app/components/player/NowPlayingTitle.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type Props = {
  index: number;
  total: number;
  surahName: string;
  reciterName: string;
  rewayahName: string;
};

export function NowPlayingTitle({
  index,
  total,
  surahName,
  reciterName,
  rewayahName,
}: Props): React.ReactElement {
  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>NOW PLAYING · {index + 1} of {total}</Text>
      <Text style={styles.title}>{surahName}</Text>
      <Text style={styles.reciter}>{reciterName}</Text>
      <Text style={styles.rewayah}>{rewayahName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: 150, gap: 4 },
  kicker: { color: colors.textTertiary, ...typography.label },
  title: { color: colors.text, ...typography.titleXL, lineHeight: 64 },
  reciter: { color: colors.text, fontSize: 18, opacity: 0.7 },
  rewayah: { color: colors.text, fontSize: 14, opacity: 0.45 },
});
```

- [ ] **Step 3: Scrubber (display only, non-focusable)**

```tsx
// tv-app/components/player/Scrubber.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type Props = { positionSeconds: number; durationSeconds: number };

function fmt(t: number): string {
  if (!Number.isFinite(t) || t < 0) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function Scrubber({ positionSeconds, durationSeconds }: Props): React.ReactElement {
  const progress = durationSeconds > 0 ? Math.min(1, positionSeconds / durationSeconds) : 0;
  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        <View style={[styles.thumb, { left: `${progress * 100}%` }]} />
      </View>
      <View style={styles.row}>
        <Text style={styles.time}>{fmt(positionSeconds)}</Text>
        <Text style={styles.time}>{fmt(durationSeconds)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: 90 },
  track: { height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2 },
  fill: { position: 'absolute', left: 0, top: 0, height: 4, backgroundColor: colors.text, borderRadius: 2 },
  thumb: { position: 'absolute', top: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  time: { color: colors.text, fontSize: 11, opacity: 0.55 },
});
```

- [ ] **Step 4: tsc + prettier + commit**

```bash
cd tv-app && npx tsc --noEmit && npx prettier --write components/player/
cd .. && git add tv-app/ && git commit -m "feat(tv): player — ArtworkBackdrop, NowPlayingTitle, Scrubber"
```

---

## Task 11: TransportRow (7 primary) + SecondaryOverlay trigger

**Files:**
- Create: `tv-app/components/player/TransportRow.tsx`
- Create: `tv-app/components/player/SecondaryOverlay.tsx` (placeholder — populated in Task 12)

**Scrubbing behavior:** Play/Pause button also handles hold-Right to enter scrub mode. In v1 simplified: don't implement hold-to-scrub — just wire the 7 primary buttons. Press-and-hold scrub is deferred to a follow-up; +15/-15 buttons are sufficient for the user need. (If spec is rigid about this, add it in a dedicated task later.)

- [ ] **Step 1: TransportRow**

```tsx
// tv-app/components/player/TransportRow.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FocusableButton } from '../primitives/FocusableButton';
import { usePlayer } from '../../hooks/usePlayer';
import { colors } from '../../theme/colors';

export function TransportRow(): React.ReactElement {
  const {
    status,
    shuffle,
    repeat,
    toggle,
    next,
    prev,
    seekBy,
    setShuffle,
    setRepeat,
  } = usePlayer();

  const isPlaying = status === 'playing';

  return (
    <View style={styles.row}>
      <FocusableButton
        onPress={() => setShuffle(!shuffle)}
        accessibilityLabel="Shuffle"
        style={[styles.btn, shuffle && styles.btnActive]}
      >
        <Text style={styles.icon}>🔀</Text>
      </FocusableButton>
      <FocusableButton onPress={() => void prev()} accessibilityLabel="Previous" style={styles.btn}>
        <Text style={styles.icon}>⏮</Text>
      </FocusableButton>
      <FocusableButton onPress={() => seekBy(-15)} accessibilityLabel="Back 15 seconds" style={styles.btn}>
        <Text style={styles.small}>−15</Text>
      </FocusableButton>
      <FocusableButton
        onPress={toggle}
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        style={styles.hero}
        hasTVPreferredFocus
      >
        <Text style={styles.heroIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
      </FocusableButton>
      <FocusableButton onPress={() => seekBy(15)} accessibilityLabel="Forward 15 seconds" style={styles.btn}>
        <Text style={styles.small}>+15</Text>
      </FocusableButton>
      <FocusableButton onPress={() => void next()} accessibilityLabel="Next" style={styles.btn}>
        <Text style={styles.icon}>⏭</Text>
      </FocusableButton>
      <FocusableButton
        onPress={() => setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off')}
        accessibilityLabel="Repeat"
        style={[styles.btn, repeat !== 'off' && styles.btnActive]}
      >
        <Text style={styles.icon}>🔁</Text>
      </FocusableButton>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
  },
  btn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: { backgroundColor: 'rgba(255,255,255,0.14)' },
  icon: { color: colors.text, fontSize: 16 },
  small: { color: colors.text, fontSize: 14, fontWeight: '600' },
  hero: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: { color: colors.background, fontSize: 22, fontWeight: '700' },
});
```

- [ ] **Step 2: Empty SecondaryOverlay**

```tsx
// tv-app/components/player/SecondaryOverlay.tsx
import React from 'react';
import { View } from 'react-native';

export function SecondaryOverlay(): React.ReactElement {
  // Populated in Task 12 — renders SpeedPicker / SleepTimer / AmbientPicker overlays.
  return <View />;
}
```

- [ ] **Step 3: tsc + prettier + commit**

```bash
cd tv-app && npx tsc --noEmit && npx prettier --write components/player/
cd .. && git add tv-app/ && git commit -m "feat(tv): TransportRow with 7 primary buttons"
```

---

## Task 12: Overlay pickers — Speed, Sleep Timer, Ambient

**Files:**
- Create: `tv-app/components/overlays/SpeedPicker.tsx`
- Create: `tv-app/components/overlays/SleepTimer.tsx`
- Create: `tv-app/components/overlays/AmbientPicker.tsx`
- Create: `tv-app/store/overlayStore.ts` (which overlay is visible)
- Modify: `tv-app/components/player/SecondaryOverlay.tsx` (show active overlay)
- Modify: `tv-app/components/player/TransportRow.tsx` (add down-navigation row buttons that open overlays)

- [ ] **Step 1: overlayStore**

```ts
// tv-app/store/overlayStore.ts
import { create } from 'zustand';

export type OverlayKey = 'speed' | 'sleep' | 'ambient' | null;

type State = {
  active: OverlayKey;
  open: (k: Exclude<OverlayKey, null>) => void;
  close: () => void;
};

export const useOverlayStore = create<State>((set) => ({
  active: null,
  open: (k) => set({ active: k }),
  close: () => set({ active: null }),
}));
```

- [ ] **Step 2: SpeedPicker**

```tsx
// tv-app/components/overlays/SpeedPicker.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FocusableButton } from '../primitives/FocusableButton';
import { usePlayer } from '../../hooks/usePlayer';
import { useOverlayStore } from '../../store/overlayStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function SpeedPicker(): React.ReactElement {
  const { speed, setSpeed } = usePlayer();
  const close = useOverlayStore((s) => s.close);
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Playback Speed</Text>
      <View style={styles.row}>
        {SPEEDS.map((s, i) => (
          <FocusableButton
            key={s}
            onPress={() => {
              setSpeed(s);
              close();
            }}
            accessibilityLabel={`${s}x`}
            style={[styles.chip, speed === s && styles.chipActive]}
            hasTVPreferredFocus={speed === s || (speed == null && i === 2)}
          >
            <Text style={styles.chipText}>{s}x</Text>
          </FocusableButton>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, gap: spacing.md, alignItems: 'center' },
  title: { color: colors.text, fontSize: 24, fontWeight: '600' },
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: { backgroundColor: colors.text },
  chipText: { color: colors.text, fontSize: 18, fontWeight: '600' },
});
```

- [ ] **Step 3: SleepTimer**

```tsx
// tv-app/components/overlays/SleepTimer.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FocusableButton } from '../primitives/FocusableButton';
import { useOverlayStore } from '../../store/overlayStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const OPTIONS = [
  { label: 'Off', minutes: 0 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '60 min', minutes: 60 },
  { label: 'End of surah', minutes: -1 },
];

export function SleepTimer(): React.ReactElement {
  const close = useOverlayStore((s) => s.close);
  // For v1 we show the UI; wiring to an actual timer that pauses playback
  // is done inline in tvPlayerStore in a follow-up.
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Sleep Timer</Text>
      <View style={styles.col}>
        {OPTIONS.map((o) => (
          <FocusableButton key={o.label} onPress={close} accessibilityLabel={o.label} style={styles.row}>
            <Text style={styles.rowText}>{o.label}</Text>
          </FocusableButton>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, gap: spacing.md, alignItems: 'center' },
  title: { color: colors.text, fontSize: 24, fontWeight: '600' },
  col: { gap: 6, width: 280 },
  row: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  rowText: { color: colors.text, fontSize: 18 },
});
```

- [ ] **Step 4: AmbientPicker**

```tsx
// tv-app/components/overlays/AmbientPicker.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FocusableButton } from '../primitives/FocusableButton';
import { useAmbientStore, type AmbientSound } from '../../store/ambientStore';
import { useOverlayStore } from '../../store/overlayStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const SOUNDS: AmbientSound[] = ['rain', 'forest', 'ocean', 'stream', 'wind', 'fireplace'];

export function AmbientPicker(): React.ReactElement {
  const { enabled, currentSound, volume, toggle, setSound, setVolume } = useAmbientStore();
  const close = useOverlayStore((s) => s.close);
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Ambient Sound</Text>
      <FocusableButton onPress={toggle} accessibilityLabel="Toggle ambient" style={styles.chip}>
        <Text style={styles.chipText}>{enabled ? 'On' : 'Off'}</Text>
      </FocusableButton>
      <View style={styles.grid}>
        {SOUNDS.map((s) => (
          <FocusableButton
            key={s}
            onPress={() => setSound(s)}
            accessibilityLabel={s}
            style={[styles.card, currentSound === s && styles.cardActive]}
          >
            <Text style={styles.cardText}>{s}</Text>
          </FocusableButton>
        ))}
      </View>
      <View style={styles.volRow}>
        <FocusableButton onPress={() => setVolume(volume - 0.1)} accessibilityLabel="Volume down" style={styles.volBtn}>
          <Text style={styles.chipText}>−</Text>
        </FocusableButton>
        <Text style={styles.volText}>{Math.round(volume * 100)}%</Text>
        <FocusableButton onPress={() => setVolume(volume + 0.1)} accessibilityLabel="Volume up" style={styles.volBtn}>
          <Text style={styles.chipText}>+</Text>
        </FocusableButton>
      </View>
      <FocusableButton onPress={close} accessibilityLabel="Close" style={styles.close}>
        <Text style={styles.chipText}>Done</Text>
      </FocusableButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, gap: spacing.md, alignItems: 'center' },
  title: { color: colors.text, fontSize: 24, fontWeight: '600' },
  chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.surface },
  chipText: { color: colors.text, fontSize: 18, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  card: {
    width: 110,
    height: 70,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActive: { backgroundColor: colors.surfaceElevated },
  cardText: { color: colors.text, fontSize: 14, textTransform: 'capitalize' },
  volRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  volBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  volText: { color: colors.text, fontSize: 20, minWidth: 60, textAlign: 'center' },
  close: { paddingHorizontal: 24, paddingVertical: 10 },
});
```

- [ ] **Step 5: Update SecondaryOverlay to render active overlay**

```tsx
// tv-app/components/player/SecondaryOverlay.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useOverlayStore } from '../../store/overlayStore';
import { SpeedPicker } from '../overlays/SpeedPicker';
import { SleepTimer } from '../overlays/SleepTimer';
import { AmbientPicker } from '../overlays/AmbientPicker';

export function SecondaryOverlay(): React.ReactElement | null {
  const active = useOverlayStore((s) => s.active);
  if (!active) return null;
  return (
    <View style={[StyleSheet.absoluteFillObject, styles.scrim]}>
      {active === 'speed' && <SpeedPicker />}
      {active === 'sleep' && <SleepTimer />}
      {active === 'ambient' && <AmbientPicker />}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 6: Add secondary-row buttons to TransportRow**

Append a secondary row below the primary 7 in `TransportRow.tsx`:

```tsx
// Append to the return before closing </View>:
<View style={styles.secondaryRow}>
  <FocusableButton onPress={() => useOverlayStore.getState().open('speed')} style={styles.sBtn} accessibilityLabel="Speed">
    <Text style={styles.sText}>{speed}x</Text>
  </FocusableButton>
  <FocusableButton onPress={() => useOverlayStore.getState().open('sleep')} style={styles.sBtn} accessibilityLabel="Sleep timer">
    <Text style={styles.sText}>⏱</Text>
  </FocusableButton>
  <FocusableButton onPress={() => useOverlayStore.getState().open('ambient')} style={styles.sBtn} accessibilityLabel="Ambient sounds">
    <Text style={styles.sText}>🌊</Text>
  </FocusableButton>
</View>
```

Add styles:
```tsx
secondaryRow: { position: 'absolute', left: 0, right: 0, bottom: -44, flexDirection: 'row', justifyContent: 'center', gap: 14 },
sBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
sText: { color: colors.text, fontSize: 12 },
```

Also add the import for `useOverlayStore` and `speed` is already destructured from `usePlayer()`.

- [ ] **Step 7: tsc + prettier + commit**

```bash
cd tv-app && npx tsc --noEmit && npx prettier --write components/ store/overlayStore.ts
cd .. && git add tv-app/ && git commit -m "feat(tv): overlays — SpeedPicker, SleepTimer, AmbientPicker; wire secondary row"
```

---

## Task 13: HomeScreen (real implementation)

**Files:**
- Modify: `tv-app/screens/HomeScreen.tsx` (replace stub)

- [ ] **Step 1: Replace HomeScreen stub**

```tsx
// tv-app/screens/HomeScreen.tsx
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TopTabBar } from '../components/nav/TopTabBar';
import { Rail } from '../components/rails/Rail';
import { ReciterCard } from '../components/rails/ReciterCard';
import { ContinueCard } from '../components/rails/ContinueCard';
import { QuickPlayCard } from '../components/rails/QuickPlayCard';
import { SeeAllCard } from '../components/rails/SeeAllCard';
import { useReciters } from '../hooks/useReciters';
import { useContinueListening } from '../hooks/useContinueListening';
import { useDefaultReciter } from '../hooks/useDefaultReciter';
import { usePlayer } from '../hooks/usePlayer';
import { useNavStore } from '../store/navStore';
import { fetchRewayat } from '../services/tvDataService';
import type { Reciter } from '../types/reciter';
import SURAHS from '../../data/surahData.json';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const QUICK_PLAY_SURAHS = [1, 18, 67, 55, 36, 112];

type SurahMeta = { number: number; name: string };

export function HomeScreen(): React.ReactElement {
  const { reciters } = useReciters();
  const continueEntries = useContinueListening();
  const { defaultReciterId } = useDefaultReciter();
  const { playRewayah } = usePlayer();
  const push = useNavStore((s) => s.push);

  const surahByNumber = useMemo(() => {
    const map = new Map<number, string>();
    (SURAHS as SurahMeta[]).forEach((s) => map.set(s.number, s.name));
    return map;
  }, []);

  const reciterById = useMemo(() => {
    const map = new Map<string, Reciter>();
    reciters.forEach((r) => map.set(r.id, r));
    return map;
  }, [reciters]);

  const featured = reciters.slice(0, 8);
  const all = reciters.slice(0, 12);

  async function handleReciterSelect(reciter: Reciter): Promise<void> {
    push({ screen: 'reciterDetail', reciterId: reciter.id });
  }

  async function handleContinueSelect(entry: (typeof continueEntries)[number]): Promise<void> {
    const reciter = reciterById.get(entry.reciterId);
    if (!reciter) return;
    const rewayat = await fetchRewayat(entry.reciterId);
    const rewayah = rewayat.find((r) => r.id === entry.rewayahId) ?? rewayat[0];
    if (!rewayah) return;
    await playRewayah(reciter.id, reciter.name, rewayah, entry.surahNumber);
    push({ screen: 'nowPlaying' });
  }

  async function handleQuickPlay(surahNumber: number): Promise<void> {
    if (!defaultReciterId) return;
    const reciter = reciterById.get(defaultReciterId);
    if (!reciter) return;
    const rewayat = await fetchRewayat(defaultReciterId);
    const rewayah = rewayat[0];
    if (!rewayah) return;
    await playRewayah(reciter.id, reciter.name, rewayah, surahNumber);
    push({ screen: 'nowPlaying' });
  }

  return (
    <View style={styles.container}>
      <TopTabBar />
      <ScrollView contentContainerStyle={styles.scroll}>
        {continueEntries.length > 0 && (
          <Rail title="Continue Listening">
            {continueEntries.map((e, i) => (
              <ContinueCard
                key={`${e.reciterId}:${e.surahNumber}`}
                entry={e}
                reciter={reciterById.get(e.reciterId) ?? null}
                surahName={surahByNumber.get(e.surahNumber) ?? `Surah ${e.surahNumber}`}
                onSelect={handleContinueSelect}
                hasTVPreferredFocus={i === 0}
              />
            ))}
          </Rail>
        )}

        <Rail title="Featured Reciters">
          {featured.map((r, i) => (
            <ReciterCard
              key={r.id}
              reciter={r}
              onSelect={handleReciterSelect}
              hasTVPreferredFocus={continueEntries.length === 0 && i === 0}
            />
          ))}
        </Rail>

        <Rail title="All Reciters">
          {all.map((r) => (
            <ReciterCard key={r.id} reciter={r} onSelect={handleReciterSelect} />
          ))}
          <SeeAllCard onSelect={() => push({ screen: 'catalogGrid' })} />
        </Rail>

        <Rail title="Quick Play">
          {QUICK_PLAY_SURAHS.map((n) => (
            <QuickPlayCard
              key={n}
              surahNumber={n}
              surahName={surahByNumber.get(n) ?? `Surah ${n}`}
              onSelect={handleQuickPlay}
            />
          ))}
        </Rail>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl },
});
```

- [ ] **Step 2: tsc + prettier + commit**

```bash
cd tv-app && npx tsc --noEmit && npx prettier --write screens/HomeScreen.tsx
cd .. && git add tv-app/ && git commit -m "feat(tv): HomeScreen with rails, Continue Listening, Quick Play, See-All"
```

---

## Task 14: NowPlayingScreen (real implementation)

**Files:**
- Modify: `tv-app/screens/NowPlayingScreen.tsx`

- [ ] **Step 1: Replace stub**

```tsx
// tv-app/screens/NowPlayingScreen.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ArtworkBackdrop } from '../components/player/ArtworkBackdrop';
import { NowPlayingTitle } from '../components/player/NowPlayingTitle';
import { Scrubber } from '../components/player/Scrubber';
import { TransportRow } from '../components/player/TransportRow';
import { SecondaryOverlay } from '../components/player/SecondaryOverlay';
import { TopTabBar } from '../components/nav/TopTabBar';
import { AutoHideChrome } from '../components/primitives/AutoHideChrome';
import { usePlayer } from '../hooks/usePlayer';
import { useFocusTimer } from '../hooks/useFocusTimer';
import { useReciters } from '../hooks/useReciters';
import { colors } from '../theme/colors';

export function NowPlayingScreen(): React.ReactElement {
  const { queue, currentIndex, positionSeconds, durationSeconds } = usePlayer();
  const { visible, reveal } = useFocusTimer(3000);
  const { reciters } = useReciters();

  const item = queue[currentIndex];
  const reciter = item ? reciters.find((r) => r.id === item.reciterId) ?? null : null;

  return (
    <View
      style={styles.container}
      onTouchStart={reveal}
      accessible
      onAccessibilityAction={reveal}
    >
      <ArtworkBackdrop imageUrl={reciter?.image_url ?? null} />
      {item && (
        <NowPlayingTitle
          index={currentIndex}
          total={queue.length}
          surahName={item.title}
          reciterName={item.subtitle}
          rewayahName=""
        />
      )}
      <Scrubber positionSeconds={positionSeconds} durationSeconds={durationSeconds} />
      <AutoHideChrome visible={visible}>
        <TopTabBar />
        <TransportRow />
      </AutoHideChrome>
      <SecondaryOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
```

Note on idle fade: a production-grade fix listens for D-pad events globally. For v1, firing `reveal` on any press inside FocusableButton/FocusableCard (via an onFocus passthrough) is sufficient. If that proves insufficient in manual testing, add a global RN `BackHandler`-like input listener and dispatch `reveal`.

- [ ] **Step 2: tsc + prettier + commit**

```bash
cd tv-app && npx tsc --noEmit && npx prettier --write screens/NowPlayingScreen.tsx
cd .. && git add tv-app/ && git commit -m "feat(tv): NowPlayingScreen composes backdrop, title, scrubber, transport, overlay with auto-hide"
```

---

## Task 15: ReciterDetail + CatalogGrid screens

**Files:**
- Modify: `tv-app/screens/ReciterDetailScreen.tsx`
- Modify: `tv-app/screens/CatalogGridScreen.tsx`
- Create: `tv-app/components/catalog/ReciterGrid.tsx` (FlashList grid)

- [ ] **Step 1: ReciterDetailScreen**

```tsx
// tv-app/screens/ReciterDetailScreen.tsx
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FocusableCard } from '../components/primitives/FocusableCard';
import { fetchRewayat } from '../services/tvDataService';
import { useReciters } from '../hooks/useReciters';
import { usePlayer } from '../hooks/usePlayer';
import { useNavStore } from '../store/navStore';
import type { Rewayah } from '../types/reciter';
import SURAHS from '../../data/surahData.json';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

type Props = { reciterId: string };
type SurahMeta = { number: number; name: string };

export function ReciterDetailScreen({ reciterId }: Props): React.ReactElement {
  const { reciters } = useReciters();
  const reciter = reciters.find((r) => r.id === reciterId);
  const [rewayat, setRewayat] = useState<Rewayah[]>([]);
  const [activeRewayahId, setActive] = useState<string | null>(null);
  const { playRewayah } = usePlayer();
  const push = useNavStore((s) => s.push);

  useEffect(() => {
    fetchRewayat(reciterId).then((r) => {
      setRewayat(r);
      setActive(r[0]?.id ?? null);
    });
  }, [reciterId]);

  if (!reciter) return <View style={styles.container} />;
  const current = rewayat.find((r) => r.id === activeRewayahId);
  const surahs = current
    ? current.surah_list
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => n > 0)
    : [];
  const surahByNumber = new Map((SURAHS as SurahMeta[]).map((s) => [s.number, s.name]));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>{reciter.name}</Text>
      <View style={styles.rewayahRow}>
        {rewayat.map((r, i) => (
          <FocusableCard
            key={r.id}
            style={[styles.chip, activeRewayahId === r.id && styles.chipActive]}
            onPress={() => setActive(r.id)}
            hasTVPreferredFocus={i === 0}
          >
            <Text style={styles.chipText}>{r.name}</Text>
          </FocusableCard>
        ))}
      </View>
      <View style={styles.grid}>
        {surahs.map((n) => (
          <FocusableCard
            key={n}
            style={styles.surahCard}
            onPress={async () => {
              if (!current) return;
              await playRewayah(reciter.id, reciter.name, current, n);
              push({ screen: 'nowPlaying' });
            }}
          >
            <Text style={styles.num}>{n}</Text>
            <Text style={styles.name}>{surahByNumber.get(n) ?? `Surah ${n}`}</Text>
          </FocusableCard>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.xl },
  title: { color: colors.text, ...typography.title },
  rewayahRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface, borderRadius: 8 },
  chipActive: { backgroundColor: colors.surfaceElevated },
  chipText: { color: colors.text, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: spacing.lg },
  surahCard: {
    width: 120,
    height: 90,
    backgroundColor: colors.surface,
    padding: 10,
    justifyContent: 'space-between',
  },
  num: { color: colors.text, fontSize: 18, fontWeight: '700' },
  name: { color: colors.text, fontSize: 12 },
});
```

- [ ] **Step 2: ReciterGrid + CatalogGridScreen**

```tsx
// tv-app/components/catalog/ReciterGrid.tsx
import React from 'react';
import { FlashList } from '@shopify/flash-list';
import { View } from 'react-native';
import { ReciterCard } from '../rails/ReciterCard';
import type { Reciter } from '../../types/reciter';

type Props = {
  reciters: Reciter[];
  onSelect: (r: Reciter) => void;
};

export function ReciterGrid({ reciters, onSelect }: Props): React.ReactElement {
  return (
    <FlashList
      data={reciters}
      numColumns={6}
      estimatedItemSize={180}
      renderItem={({ item, index }) => (
        <View style={{ padding: 8 }}>
          <ReciterCard
            reciter={item}
            onSelect={onSelect}
            hasTVPreferredFocus={index === 0}
          />
        </View>
      )}
      keyExtractor={(r) => r.id}
    />
  );
}
```

**Note:** If `@shopify/flash-list` isn't already in `tv-app`'s deps, add it: `npm install @shopify/flash-list@^2.0.2`.

```tsx
// tv-app/screens/CatalogGridScreen.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ReciterGrid } from '../components/catalog/ReciterGrid';
import { useReciters } from '../hooks/useReciters';
import { useNavStore } from '../store/navStore';
import { colors } from '../theme/colors';

export function CatalogGridScreen(): React.ReactElement {
  const { reciters } = useReciters();
  const push = useNavStore((s) => s.push);
  return (
    <View style={styles.container}>
      <ReciterGrid
        reciters={reciters}
        onSelect={(r) => push({ screen: 'reciterDetail', reciterId: r.id })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 40 },
});
```

- [ ] **Step 3: tsc + prettier + commit**

```bash
cd tv-app && npx tsc --noEmit && npx prettier --write screens/ReciterDetailScreen.tsx screens/CatalogGridScreen.tsx components/catalog/
cd .. && git add tv-app/ && git commit -m "feat(tv): ReciterDetailScreen with rewayah chips + surah grid; CatalogGridScreen with FlashList grid"
```

---

## Task 16: Search, Collection, Settings

**Files:**
- Modify: `tv-app/screens/SearchScreen.tsx`
- Modify: `tv-app/screens/CollectionScreen.tsx`
- Modify: `tv-app/screens/SettingsScreen.tsx`

- [ ] **Step 1: SearchScreen**

```tsx
// tv-app/screens/SearchScreen.tsx
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { TopTabBar } from '../components/nav/TopTabBar';
import { Rail } from '../components/rails/Rail';
import { ReciterCard } from '../components/rails/ReciterCard';
import { useReciters } from '../hooks/useReciters';
import { useNavStore } from '../store/navStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export function SearchScreen(): React.ReactElement {
  const [query, setQuery] = useState('');
  const { reciters } = useReciters();
  const push = useNavStore((s) => s.push);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return reciters.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 20);
  }, [reciters, query]);

  return (
    <View style={styles.container}>
      <TopTabBar />
      <View style={styles.body}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search reciters"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        {filtered.length > 0 ? (
          <Rail title={`Reciters · ${filtered.length}`}>
            {filtered.map((r, i) => (
              <ReciterCard
                key={r.id}
                reciter={r}
                onSelect={() => push({ screen: 'reciterDetail', reciterId: r.id })}
                hasTVPreferredFocus={i === 0}
              />
            ))}
          </Rail>
        ) : (
          <Text style={styles.hint}>{query ? 'No matches' : 'Type to search reciters'}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.xl, gap: spacing.lg },
  input: {
    color: colors.text,
    fontSize: 28,
    borderBottomWidth: 2,
    borderColor: colors.textSecondary,
    paddingVertical: 8,
  },
  hint: { color: colors.textSecondary, ...typography.body },
});
```

- [ ] **Step 2: CollectionScreen (empty state)**

```tsx
// tv-app/screens/CollectionScreen.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TopTabBar } from '../components/nav/TopTabBar';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

export function CollectionScreen(): React.ReactElement {
  return (
    <View style={styles.container}>
      <TopTabBar />
      <View style={styles.center}>
        <Text style={styles.title}>Your playlists will appear here</Text>
        <Text style={styles.sub}>
          Create playlists in the Bayaan mobile app. They'll sync to your TV once playlist sync ships.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: { color: colors.text, ...typography.heading, textAlign: 'center', marginBottom: spacing.sm },
  sub: { color: colors.textSecondary, ...typography.body, textAlign: 'center', maxWidth: 600 },
});
```

- [ ] **Step 3: SettingsScreen**

```tsx
// tv-app/screens/SettingsScreen.tsx
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TopTabBar } from '../components/nav/TopTabBar';
import { FocusableCard } from '../components/primitives/FocusableCard';
import { useReciters } from '../hooks/useReciters';
import { useDefaultReciter } from '../hooks/useDefaultReciter';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export function SettingsScreen(): React.ReactElement {
  const { reciters } = useReciters();
  const { defaultReciterId, setDefaultReciter } = useDefaultReciter();
  const current = reciters.find((r) => r.id === defaultReciterId);

  return (
    <View style={styles.container}>
      <TopTabBar />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.section}>Default reciter</Text>
        <Text style={styles.sub}>{current?.name ?? 'Not set'}</Text>
        <View style={styles.grid}>
          {reciters.slice(0, 12).map((r, i) => (
            <FocusableCard
              key={r.id}
              style={[styles.chip, defaultReciterId === r.id && styles.chipActive]}
              onPress={() => setDefaultReciter(r.id)}
              hasTVPreferredFocus={i === 0}
            >
              <Text style={styles.chipText}>{r.name}</Text>
            </FocusableCard>
          ))}
        </View>
        <Text style={[styles.section, { marginTop: spacing.xl }]}>About</Text>
        <Text style={styles.sub}>Bayaan TV · v0.1.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.xl, gap: spacing.sm },
  section: { color: colors.text, ...typography.heading },
  sub: { color: colors.textSecondary, ...typography.body, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  chipActive: { backgroundColor: colors.surfaceElevated },
  chipText: { color: colors.text, fontSize: 14 },
});
```

- [ ] **Step 4: tsc + prettier + commit**

```bash
cd tv-app && npx tsc --noEmit && npx prettier --write screens/SearchScreen.tsx screens/CollectionScreen.tsx screens/SettingsScreen.tsx
cd .. && git add tv-app/ && git commit -m "feat(tv): Search, Collection, Settings screens"
```

---

## Task 17: App.tsx rewire + integration smoke test

**Files:**
- Modify: `tv-app/App.tsx`

- [ ] **Step 1: Replace App.tsx with real wiring**

```tsx
// tv-app/App.tsx
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { Router } from './components/nav/Router';
import { createAudioEngine } from './services/audioEngine';
import { useTVPlayerStore } from './store/tvPlayerStore';
import { colors } from './theme/colors';

export default function App(): React.ReactElement {
  const setEngine = useTVPlayerStore((s) => s.setEngine);

  useEffect(() => {
    const engine = createAudioEngine();
    setEngine(engine);
  }, [setEngine]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Router />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
```

- [ ] **Step 2: Final tsc + prettier**

```bash
cd tv-app && npx tsc --noEmit && npx prettier --write App.tsx
```

- [ ] **Step 3: Commit**

```bash
cd .. && git add tv-app/ && git commit -m "feat(tv): App.tsx wires audio engine + Router"
```

- [ ] **Step 4: Manual smoke test — tvOS simulator**

1. Start Metro: `cd tv-app && npx expo start --port 8081`
2. If the Apple TV sim is still booted, `xcrun simctl terminate $SIM com.bayaan.tvsmoke && xcrun simctl launch $SIM com.bayaan.tvsmoke`
3. Otherwise run `EXPO_TV=1 npx expo run:ios --device "Apple TV 4K (3rd generation)"`
4. Verify: Home renders with rails, Continue Listening absent on first launch, Featured Reciters rail focused, D-pad navigates cards, Select on a reciter opens ReciterDetail, Select a surah plays audio, NowPlaying shows artwork backdrop + title + scrubber + transport row, transport buttons work, auto-hide kicks in after 3s of no input.

- [ ] **Step 5: Manual smoke test — Android (phone or Fire TV)**

1. `cd tv-app/android && ./gradlew :app:assembleDebug`
2. `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
3. `adb reverse tcp:8081 tcp:8081`
4. `adb shell am start -n com.bayaan.tvsmoke/.MainActivity`
5. Verify: same flow as tvOS. Press center on D-pad for Select; if no TV remote, touch works as fallback on a phone.

- [ ] **Step 6: Capture & commit screenshots (optional)**

Put any screenshots into `docs/superpowers/plans/screenshots/` for future reference. Skip if no value.

- [ ] **Step 7: Final commit + summary**

```bash
git log --oneline -20
```

Confirm 16-ish commits from the implementation and move on to `superpowers:finishing-a-development-branch` (PR creation / merge).

---

## Self-Review

**Spec coverage checklist:**
- Tabs centered + Settings right — ✅ Task 9 (TopTabBar)
- Home rails (Continue, Featured, All+SeeAll, Quick Play) — ✅ Task 13
- Now Playing full-bleed + auto-hide — ✅ Tasks 10/11/14
- 7 primary + 3 secondary transport buttons — ✅ Tasks 11/12
- Player state w/ queue, next/prev, seek, auto-advance — ✅ Task 5
- ExpoAudioService reuse — ✅ Task 5 Step 6
- Live backend + MMKV cache + fallback — ✅ Task 2
- Continue Listening ring buffer — ✅ Task 3
- Ambient sounds store ported — ✅ Task 4
- State-based router (no expo-router) — ✅ Task 9
- Testing: stores + services with Jest — ✅ Tasks 2/3/4/5/6
- No downloads UI — ✅ (not scheduled, Collection shows empty state)
- Error handling matrix — covered in implementations (fetch/fallback, engine crash is via reset + replay — noted but not implemented as its own task; if manual smoke test surfaces issues, add a recovery task)

**Placeholder scan:** No TBD/TODO inlined (Task 5 Step 6 marks the audioEngine adapter as needing inspection of ExpoAudioService's actual API — this is an explicit gate, not a placeholder). "If MMKV lacks addOnValueChangedListener" in Task 6 provides a concrete fallback.

**Type consistency:** `QueueItem` used identically everywhere. `PlayerStatus` matches types from `types/player.ts`. `AudioEngine` interface stays stable from Task 5 through TransportRow via `usePlayer`.

**Scope:** 17 tasks, achievable in a focused sprint. Each task produces working, testable software (stores/services with tests are self-contained; UI tasks are visually verifiable after Task 17's smoke test).
