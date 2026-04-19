# Bayaan TV Player — Design Spec

**Date:** 2026-04-18
**Branch:** `feature/tv-platforms`
**Location:** `.worktrees/tv-platforms/tv-app/`

## Overview

A React Native + Expo app for **Apple TV (tvOS)** and **Android TV** that delivers a Spotify-caliber audio experience for the Bayaan Quran recitations catalog. Visual language is Apple Music TV: cinematic full-bleed artwork, massive typography, D-pad navigation, auto-hiding chrome. Ships as a sibling to the existing Bayaan phone app, sharing the audio engine and data layer but not UI.

## Goals

- Cinematic, focus-driven browsing of reciters and surahs
- Full-fidelity audio player with 9 transport controls (phone parity)
- Continue Listening as the first-class entry point for returning users
- Auto-hide chrome during playback for an immersive experience
- Live backend with offline cache fallback, same data schema as phone

## Non-goals (v1)

- Quran text / Mushaf / ayah display — no on-screen recitation text
- Downloads / offline audio on TV (TVs are typically connected)
- Cross-device continue-listening sync with phone (local-only v1; sync is v2)
- Shuffle/repeat UI polish beyond on/off toggles
- Social features, sharing, playlists beyond what the phone app already exposes
- expo-router based navigation (unsupported on tvOS by `@react-native-tvos/config-tv`)

## Decisions (quick reference)

| Area | Decision |
|---|---|
| Visual style | Apple Music TV — cinematic full-bleed artwork, massive typography |
| Home entry | Netflix-style Continue Listening rail first, then reciter rails, then Quick Play |
| Navigation | Top tab bar, tabs centered: Home · Search · Collection; Settings anchored to right edge |
| Audio engine | Hybrid: reuse `../services/audio/ExpoAudioService.ts`, write new TV-specific state store |
| Data source | Live backend with fallback-to-cache (MMKV) then fallback-to-bundled JSON |
| Continue Listening | Local-only v1 (MMKV ring buffer of 10 entries); backend sync is v2 |
| Transport controls | 9 buttons (phone parity): Shuffle · Prev · −15 · Play/Pause · +15 · Next · Repeat + secondary row (Speed · Sleep · Ambient) |
| Now Playing layout | Full-bleed artwork, title block bottom-left, transport bottom-center; tabs fade over content |
| Chrome auto-hide | Tabs + transport fade after 3s idle; any D-pad press reveals; first press after fade only reveals |
| Downloads | Skipped on TV v1 |
| Shared with phone | `../services/audio/ExpoAudioService`, `../services/audio/AmbientAudioService`, `../data/reciters-fallback.json`, `../data/surahData.ts`, `../data/reciterData.ts` |
| Not shared | Phone's `services/dataService.ts`, `services/player/store/playerStore.ts`, Zustand stores in `store/`, any `@gorhom/bottom-sheet` or `react-native-actions-sheet` usage |

## Information architecture

```
Top chrome (auto-hide after 3s idle on NowPlaying; always visible elsewhere):
  [        Home · Search · Collection        ]    ⚙

Screens (flat stack, not nested):
  Home           — default entry, focus lands on first rail
  Search         — keyboard-driven
  Collection     — playlists (downloads skipped v1)
  Settings       — reached via ⚙
  NowPlaying     — pushed full-screen when user selects a surah
  ReciterDetail  — overlay/push; lists surahs for selected reciter
  CatalogGrid    — full-catalog grid for "See all" from All Reciters rail
```

**Navigation rules**
- Back from NowPlaying → returns to the screen that launched playback
- Back from Home → exit confirm (Android TV requires)
- Initial focus → first card of the first rail (Continue Listening if present, else Featured Reciters)
- Pressing Up from content on a non-NowPlaying tab → moves focus to tab bar (reveals chrome if hidden)

## Home screen

Rails in order:

1. **Continue Listening** (16:9 wide cards 220×140, shows per-card progress bar) — only rendered if user has playback history
2. **Featured Reciters** (2:3 portrait cards 140×180, artwork-forward) — curated
3. **All Reciters** (2:3 portrait) — truncated list ending in a "See all →" card that opens `CatalogGrid`
4. **Quick Play Surahs** (1:1 square 120×120) — Al-Fatihah, Al-Kahf, Al-Mulk + last 3 surahs; one-press plays with user's default reciter

**Card behavior**
- Focus: scale 1.08 + 3px white ring, 150ms spring
- Select on Continue card → resumes at saved position, pushes NowPlaying
- Select on Reciter card → pushes ReciterDetail
- Select on Quick Play card → starts that surah with default reciter, pushes NowPlaying

**Rail behavior**
- Horizontal scroll with D-pad repeat acceleration
- `TVFocusGuideView` keeps focus within the rail on vertical wrap
- Up from first rail → focus tab bar; Down from tab bar → focus last-focused rail card

## Now Playing screen

**Background**: blurred reciter artwork (40px blur) + 60% dark scrim + linear gradient to bottom.

**Title block** (bottom-left, above controls):
```
NOW PLAYING · 1 of 114
Al-Fatihah                      (56pt, weight 700)
Mishari Rashid al-Afasy         (18pt, opacity 0.7)
Hafs 'an 'Asim · Murattal       (14pt, opacity 0.45)
```

**Progress bar**: 4px track full-width, 12pt circular thumb, elapsed/remaining times below.

**Transport row** (9 primary + 3 secondary):
- Primary (7): Shuffle · Prev · −15 · **Play/Pause (76pt hero)** · +15 · Next · Repeat
- Secondary (3, reached via D-pad Down from transport): Speed · Sleep Timer · Ambient
- Default focus on entry: Play/Pause
- D-pad Left/Right: navigate between buttons
- D-pad Up on Play/Pause: focus scrubber (rare path)
- Press-and-hold Right on scrubber: scrub mode (thumb turns amber, Left/Right nudges 5s, release to exit)

**Idle auto-hide**
- 3s of no D-pad input → tabs + transport fade to opacity 0 over 250ms ease-out
- Small corner label `Al-Fatihah · al-Afasy` at 35% opacity remains visible
- Any D-pad press → reveal over 150ms, reset timer
- First press after fade = reveal only (no interaction dispatched); second press interacts
- Selecting a transport button does NOT fade chrome — only idle fades it

## Search, Collection, Settings

**Search** — TV keyboard input (native on both platforms), results show as a single rail of reciters matching, plus a rail of surahs matching. Debounced 300ms.

**Collection** — Playlists only v1 (no downloads). Phone playlists are stored locally in SQLite on the phone and not currently backend-synced, so a fresh TV install will have none. Collection shows an empty state: **"Create playlists in the Bayaan mobile app. They'll appear here when sync ships."** The tab stays in place because playlists sync is a near-term v2 addition.

**Settings** — Simple list: default reciter, autoplay next surah toggle, app version, third-party licenses. No auth (Bayaan has no user accounts today).

## Player state architecture

```
UI layer
  └─ screens + components
       ↓ hooks
usePlayer          (public API, TV-specific)
  ↓ wraps
tvPlayerStore      (Zustand, TV-specific)
  ↓ delegates playback to
ExpoAudioService   (shared from phone, pure audio wrapper)
AmbientAudioService (shared from phone)
```

**tvPlayerStore state**
```ts
{
  queue: QueueItem[];           // full rewayah of current reciter
  currentIndex: number;          // position in queue
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'error';
  positionSeconds: number;
  durationSeconds: number;
  speed: 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;
  shuffle: boolean;
  repeat: 'off' | 'one' | 'all';
}
```

**Actions:** `playReciter(reciterId)`, `playSurah(reciterId, surahNumber)`, `toggle()`, `next()`, `prev()`, `seekBy(±15)`, `seekTo(seconds)`, `setSpeed(n)`, `setShuffle(bool)`, `setRepeat(mode)`.

**Queue loading rule**: when a user picks any surah, build the full rewayah queue, set `currentIndex` to that surah's position, start playback. Next/Prev always walks the same queue.

**Auto-advance**: when audio ends, advance `currentIndex` by 1 (wrap based on `repeat` mode), load next into `ExpoAudioService`, start playback.

**Continue Listening persistence**
- Key: `bayaan_tv_continue`
- Storage: MMKV (sync reads for instant home render)
- Ring buffer: 10 entries, sorted by `updatedAt` desc, deduped on `(reciterId, surahNumber)`
- Writer triggers: every 5s during playback, on pause, on track change, on app background
- Shape: `{ reciterId, rewayahId, surahNumber, positionSeconds, durationSeconds, updatedAt }[]`

**Default reciter**: stored as `bayaan_tv_default_reciter_id` in MMKV. Initializes to first featured reciter on first run.

**Ambient sounds**: separate `AmbientAudioService` singleton (shared from phone). `tv-app/store/ambientStore.ts` (Zustand, ported from phone's `ambientStore.ts` — pure JS). Overlay in NowPlaying secondary row lets user pick sound + volume.

## Data flow & service reuse

**New file: `tv-app/services/tvDataService.ts` (~150 lines)**
- Hits same backend URL (`EXPO_PUBLIC_BAYAAN_API_URL`)
- Uses same killswitch CDN config
- Cache in MMKV (sync) under keys `bayaan_reciters`, `bayaan_reciter_servers` — shared namespace with phone where possible
- Falls back to `../data/reciters-fallback.json`
- Pure functions, no Zustand coupling

**API surface:**
```ts
export async function fetchReciters(opts?: { skipCache?: boolean }): Promise<Reciter[]>;
export async function fetchRewayat(reciterId: string): Promise<Rewayah[]>;
export function getCachedReciters(): Reciter[] | null;
export function buildAudioUrl(server: string, surahNumber: number): string;
```

**Home launch flow**
1. Home renders instantly from `getCachedReciters()` (MMKV sync) — if empty, falls back to bundled JSON
2. `useEffect` → `fetchReciters()` → updates MMKV → subscription triggers re-render
3. Network fail → keep cache/fallback, log to Sentry
4. Killswitch ON → skip live fetch entirely

**Shared data version**: `DATA_VERSION = '4'` matches phone's current version. When bumping, both apps bump together.

**Why not import phone's `services/dataService.ts` directly**: it imports `usePlayerStore`, `useReciterStore`, `useApiHealthStore` — phone Zustand stores we're not pulling in. A clean v2 cleanup is to extract pure fetchers into a shared file; for v1, duplicate ~150 lines.

## Directory layout

```
tv-app/
├── App.tsx
├── app.json
├── metro.config.js            # watchFolders = ['..'], disableHierarchicalLookup
├── package.json
├── tsconfig.json              # paths: '@bayaan/*' → '../*'
├── screens/
│   ├── HomeScreen.tsx
│   ├── SearchScreen.tsx
│   ├── CollectionScreen.tsx
│   ├── SettingsScreen.tsx
│   ├── NowPlayingScreen.tsx
│   └── ReciterDetailScreen.tsx
├── components/
│   ├── nav/              TopTabBar.tsx, Router.tsx
│   ├── rails/            Rail.tsx, RailHeader.tsx, ReciterCard.tsx,
│   │                     ContinueCard.tsx, QuickPlayCard.tsx, SeeAllCard.tsx
│   ├── player/           TransportRow.tsx, SecondaryOverlay.tsx, Scrubber.tsx,
│   │                     NowPlayingTitle.tsx, ArtworkBackdrop.tsx
│   ├── overlays/         SpeedPicker.tsx, SleepTimer.tsx, AmbientPicker.tsx
│   ├── primitives/       FocusableButton.tsx, FocusableCard.tsx, FocusRing.tsx,
│   │                     AutoHideChrome.tsx
│   └── catalog/          ReciterGrid.tsx
├── hooks/
│   ├── usePlayer.ts
│   ├── useReciters.ts
│   ├── useContinueListening.ts
│   ├── useFocusTimer.ts
│   ├── useTVBackHandler.ts
│   └── useDefaultReciter.ts
├── store/
│   ├── tvPlayerStore.ts
│   ├── ambientStore.ts
│   └── navStore.ts
├── services/
│   ├── tvDataService.ts
│   ├── continueListeningStore.ts
│   └── storage.ts
├── theme/                colors.ts, typography.ts, spacing.ts
├── types/                reciter.ts, player.ts
└── assets/audio/test.mp3
```

**Conventions**
- All interactive UI uses `FocusableButton`/`FocusableCard` primitives, never raw `Pressable` in user-facing code
- Screens are dumb; state comes from hooks; hooks wrap stores
- `services/` has no React imports (pure functions / classes)
- `@bayaan/*` path alias for imports from parent worktree

## Testing strategy

- **Unit tests (Jest + ts-jest)**
  - `tvPlayerStore` — queue actions (play/next/prev/seek) mutate state correctly
  - `continueListeningStore` — ring buffer cap 10, sort order, dedup on `(reciterId, surahNumber)`
  - `tvDataService` — fallback chain (cache hit → live → fallback JSON)
- **Manual integration smoke tests** — tvOS simulator + Android phone. Focus engine and audio integration not worth mocking.
- **No E2E** — Detox-for-tvOS is immature; not worth the setup in v1

## Error handling

| Failure | User sees | Behavior |
|---|---|---|
| Reciter fetch network fail | Nothing visible | Keep cache or fallback JSON; log to Sentry |
| Audio URL 404/network fail | Inline "Couldn't load audio. Retry?" on NowPlaying | Retry re-loads; back returns |
| Killswitch ON | Nothing visible | Skip live fetch, serve cache/fallback only |
| Unknown reciter/surah ID | Toast "Recording unavailable" | Home stays focused on prior card |
| ExpoAudioService crash | Brief buffering state, auto-recovery | Singleton re-init, replay from currentIndex at last positionSeconds |
| MMKV read fails | Empty Continue rail | Log to Sentry; proceed without history |
| First launch, no cache, no network | Fallback JSON reciters | User can browse; audio won't play except bundled test |

## Performance

- **MMKV for hot-path reads** — Continue Listening, default reciter, reciter cache
- **`@shopify/flash-list`** for any list > 10 items (per project CLAUDE.md) — catalog grid
- **`expo-image`** for artwork with `cachePolicy="memory-disk"` and `priority="high"` on visible cards
- **No anonymous functions in `renderItem`** — module-scope or `useCallback`
- **D-pad repeat** must not re-render unrelated cards — focus state held per-card, not lifted
- **Auto-hide timer** uses `setTimeout` ref, not state — avoids transport-row re-render every 100ms
- **Scrubber updates throttled** to 4 FPS (250ms) — TV doesn't need 60fps progress ticks
- **Preload next queue item's audio URL** at 85% through current — gapless-feeling transitions
- **Background/foreground**: both platforms pause on background; on resume, restore at last `positionSeconds` via `ExpoAudioService`

## Navigation implementation note

`@react-native-tvos/config-tv` README marks `expo-router` as unsupported on tvOS. Replacement: minimal state-based router in `store/navStore.ts` — a stack of screen names + params. Sufficient for 5 destinations. No dynamic route matching, no deep linking, no file-based routes.

## v2 items (captured for later)

- Cross-device Continue Listening sync with phone via backend
- Downloads browse on TV (playback of phone-downloaded audio)
- Detox E2E setup once tvOS support matures
- Pure-fetchers refactor: split phone's `services/dataService.ts` into store-coupled + pure, share the pure half with TV
- Shuffle algorithm polish (weighted by listening history)
- Sleep timer variants (end of track, end of queue, custom)
- Live Activities / Dynamic Island equivalents on relevant platforms
