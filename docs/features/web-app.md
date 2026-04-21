# Feature: Bayaan Web Application

**Status:** Proposal
**Priority:** High
**Complexity:** High
**Created:** 2026-02-21

## Overview

Build a ground-up, web-native version of Bayaan at **thebayaan.com** — a full-featured Quran audio and Mushaf experience for the browser. Not a React Native Web port, but a proper web application built with Next.js, Tailwind CSS, and the Web Audio API, borrowing the design language and data layer from the mobile app.

## User Story

As a user, I want to visit thebayaan.com and immediately browse reciters, play Quran recitations, read the Mushaf, and manage my listening experience — all from my browser on desktop, tablet, or mobile, with no app download required.

As a user, I want to share a direct link to a specific surah and reciter so that anyone I send it to can start listening instantly.

## Why a Separate Web-Native App

The mobile app is built with React Native/Expo. Rather than using Expo Web (which shoehorns native primitives into a browser), a ground-up web app allows:

- **Proper HTML semantics** — accessibility, SEO, screen readers
- **Native browser APIs** — HTML5 Audio, Service Workers, Cache API, Web Share API
- **Web-native styling** — Tailwind CSS, CSS Grid/Flexbox, media queries, responsive design
- **Server-side rendering** — SEO for every surah and reciter page
- **URL-first architecture** — deep links, shareable URLs, browser history
- **Desktop-class layouts** — sidebar navigation, persistent player bar, multi-panel views
- **No React Native Web abstractions** — no `<View>`, no `StyleSheet.create()`, no RN compatibility shims

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Next.js (App Router) | SSR/SSG for SEO, file-based routing, React Server Components |
| **Language** | TypeScript | Shared types with mobile app |
| **Styling** | Tailwind CSS | Utility-first, responsive, dark mode built-in |
| **State Management** | Zustand | Same library as mobile — store logic ports directly |
| **Audio Engine** | HTML5 Audio API | Native browser audio, Media Session API for OS controls |
| **Data** | Supabase (same backend) | Same database, same storage, same API |
| **Static Data** | reciters.json, surahs.json | Copied/shared from mobile repo |
| **Images** | Next.js `<Image>` | Optimized loading, lazy loading, responsive sizing |
| **Animations** | Framer Motion | Web-native animation library (replaces Reanimated) |
| **Fonts** | Manrope, Scheherazade New | Same typefaces as mobile app |
| **i18n** | react-i18next or next-intl | Same i18n approach, shared translation keys |
| **Hosting** | Cloudflare Pages | Global edge network, fast in MENA/Asia, generous free tier |
| **Deployment** | `@opennextjs/cloudflare` | Next.js adapter for Cloudflare Pages |
| **Domain** | thebayaan.com | Primary web domain |

## What's Shared with Mobile

| Asset | How It's Shared |
|-------|----------------|
| TypeScript types (`types/`) | Copy or npm package from shared repo |
| Zustand store logic | Port store shapes and actions (same API, different persistence) |
| Static data (reciters.json, surahs.json) | Copy to web repo or fetch from Supabase at build time |
| Design tokens (colors, spacing, typography) | Extract into shared Tailwind config / CSS variables |
| Supabase backend | Same project, same tables, same storage buckets |
| Audio file URLs | Same CDN / Supabase storage URLs |
| Translation strings | Shared i18n JSON files |
| Reciter images | Same Supabase storage URLs |

## What's Built From Scratch

| Component | Web Implementation |
|-----------|-------------------|
| Navigation | Next.js App Router (sidebar + top nav) |
| Audio engine | HTML5 `Audio` element + Media Session API |
| Player UI | Custom React component with Tailwind (persistent bottom bar) |
| Mushaf viewer | CSS/Canvas-based Uthmani page rendering |
| Storage | `localStorage` for preferences, IndexedDB for offline cache |
| Downloads/Offline | Service Worker + Cache API (PWA) |
| Bottom sheets | Modal dialogs / slide-over panels (Headless UI or Radix) |
| Lists/Grids | Native HTML + CSS Grid (no FlashList needed) |
| Haptics | N/A (web has limited vibration API, not worth it) |
| Notifications | Web Push API (optional, future) |
| Dark mode | Tailwind `dark:` variant + `prefers-color-scheme` |

## Architecture

### Repository Structure

```
bayaan-web/                    # Separate repository
├── app/                       # Next.js App Router
│   ├── layout.tsx             # Root layout (sidebar + player bar)
│   ├── page.tsx               # Home page
│   ├── reciters/
│   │   ├── page.tsx           # All reciters (grid, filterable)
│   │   └── [slug]/
│   │       └── page.tsx       # Reciter detail + surah list
│   ├── surah/
│   │   └── [id]/
│   │       └── page.tsx       # Surah page (with reciter selector)
│   ├── mushaf/
│   │   ├── page.tsx           # Mushaf viewer (page 1)
│   │   └── [page]/
│   │       └── page.tsx       # Mushaf page N
│   ├── queue/
│   │   └── page.tsx           # Queue management
│   ├── downloads/
│   │   └── page.tsx           # Offline/downloaded content
│   └── settings/
│       └── page.tsx           # Preferences, theme, language
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx        # Left navigation rail
│   │   ├── PlayerBar.tsx      # Persistent bottom player
│   │   ├── Header.tsx         # Top bar (search, settings)
│   │   └── MobileNav.tsx      # Bottom nav for mobile viewports
│   ├── player/
│   │   ├── PlayerBar.tsx      # Compact bottom player bar
│   │   ├── FullPlayer.tsx     # Expanded full-screen player
│   │   ├── ProgressBar.tsx    # Seekable progress
│   │   ├── VolumeControl.tsx  # Volume slider
│   │   └── QueuePanel.tsx     # Side panel queue view
│   ├── reciter/
│   │   ├── ReciterCard.tsx    # Reciter grid card
│   │   ├── ReciterGrid.tsx    # Responsive grid of reciters
│   │   └── ReciterDetail.tsx  # Reciter profile + surah list
│   ├── surah/
│   │   ├── SurahList.tsx      # Surah listing table/list
│   │   ├── SurahRow.tsx       # Individual surah row
│   │   └── SurahHeader.tsx    # Surah metadata header
│   ├── mushaf/
│   │   ├── MushafViewer.tsx   # Page viewer with navigation
│   │   ├── MushafPage.tsx     # Single Uthmani page render
│   │   └── MushafControls.tsx # Page nav, zoom, settings
│   ├── ambient/
│   │   ├── AmbientPanel.tsx   # Ambient sound selector
│   │   └── AmbientToggle.tsx  # Quick toggle button
│   └── ui/                    # Shared primitives
│       ├── Button.tsx
│       ├── Modal.tsx
│       ├── Slider.tsx
│       ├── Tooltip.tsx
│       └── SearchInput.tsx
├── lib/
│   ├── audio/
│   │   ├── AudioService.ts    # HTML5 Audio wrapper (singleton)
│   │   ├── AmbientService.ts  # Second Audio instance for ambient
│   │   └── MediaSession.ts    # Media Session API (OS controls)
│   ├── stores/
│   │   ├── playerStore.ts     # Ported from mobile (Zustand)
│   │   ├── queueStore.ts      # Queue state
│   │   ├── ambientStore.ts    # Ambient preferences
│   │   └── settingsStore.ts   # User preferences
│   ├── api/
│   │   ├── supabase.ts        # Supabase client
│   │   └── reciters.ts        # Data fetching helpers
│   └── utils/
│       ├── formatTime.ts      # Duration formatting
│       └── storage.ts         # localStorage helpers
├── data/
│   ├── reciters.json          # Static reciter data
│   └── surahs.json            # Surah metadata
├── styles/
│   └── globals.css            # Tailwind imports, CSS variables, fonts
├── public/
│   ├── fonts/                 # Manrope, Scheherazade
│   ├── audio/ambient/         # Bundled ambient sounds
│   └── icons/                 # Favicons, PWA icons
├── tailwind.config.ts         # Design tokens (colors, fonts, spacing)
├── next.config.ts             # Next.js configuration
└── wrangler.toml              # Cloudflare Pages config
```

### Audio Architecture

```
┌──────────────────────────────────────────────────────┐
│  Browser                                             │
│                                                      │
│  ┌────────────────┐      ┌──────────────────────┐    │
│  │  AudioService   │      │  Media Session API   │    │
│  │  (singleton)    │─────▶│  (OS-level controls) │    │
│  │                 │      │  - lock screen        │    │
│  │  new Audio()    │      │  - notification bar   │    │
│  │  .src = url     │      │  - keyboard media keys│    │
│  │  .play()        │      └──────────────────────┘    │
│  │  .pause()       │                                  │
│  │  .currentTime   │      ┌──────────────────────┐    │
│  └────────────────┘      │  AmbientService       │    │
│                           │  (second Audio())     │    │
│  ┌────────────────┐      │  .loop = true          │    │
│  │  Zustand Store  │      │  independent volume   │    │
│  │  (playerStore)  │      └──────────────────────┘    │
│  │  - currentTrack │                                  │
│  │  - isPlaying    │      ┌──────────────────────┐    │
│  │  - progress     │      │  Service Worker       │    │
│  │  - queue        │      │  (PWA offline cache)  │    │
│  └────────────────┘      │  - cached surahs       │    │
│                           │  - app shell cache     │    │
│                           └──────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

The Web Audio API is dramatically simpler than mobile audio:
- `new Audio(url)` — that's it. No native modules, no bridges.
- `.play()`, `.pause()`, `.currentTime` for seek
- `timeupdate` event for progress
- `ended` event for auto-next
- Media Session API provides lock screen / notification / keyboard media key integration for free

### Desktop Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ┌────┐  Bayaan                          🔍 Search         ⚙    │
├──┤    ├──────────────────────────────────────────────────────────┤
│  │    │                                                          │
│  │ 🏠 │   Featured Reciters                                     │
│  │Home│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │    │   │         │ │         │ │         │ │         │      │
│  │ 🎙 │   │Al-Husary│ │Minshawi │ │As-Sudais│ │Al-Ajmi  │      │
│  │Rctrs│   │         │ │         │ │         │ │         │      │
│  │    │   └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
│  │ 📖 │                                                          │
│  │Surah│   Continue Listening                                    │
│  │    │   ┌──────────────────────────────────────────────┐      │
│  │ 📕 │   │  ▶  Al-Baqarah · Al-Husary · 02:34 / 45:12  │      │
│  │Mshf│   └──────────────────────────────────────────────┘      │
│  │    │                                                          │
│  │ ⬇  │   All Surahs                                            │
│  │DLs │   ┌──────────────────────────────────────────────┐      │
│  │    │   │  1   Al-Fatiha        7 verses     Meccan    │      │
│  │    │   │  2   Al-Baqarah     286 verses     Medinan   │      │
│  │    │   │  3   Aal-Imran      200 verses     Medinan   │      │
│  │    │   │  4   An-Nisa        176 verses     Medinan   │      │
│  │    │   └──────────────────────────────────────────────┘      │
│  │    │                                                          │
├──┴────┴──────────────────────────────────────────────────────────┤
│  ▶ Al-Baqarah · Sheikh Al-Husary    ━━━━━━●━━━━━━  02:34/45:12 │
│  ⏮  ▶❚❚  ⏭    🔊━━━━━●━━━━    [Queue]  [Ambient]  [Speed]      │
└──────────────────────────────────────────────────────────────────┘
```

- **Left sidebar**: Navigation (collapsible on smaller screens)
- **Main content**: Scrollable, responsive grid/list
- **Bottom player bar**: Persistent, always visible when something is playing
- **On mobile viewports**: Sidebar collapses to bottom tab bar, player bar stacks above it

### Mobile Web Layout

```
┌─────────────────────────┐
│  Bayaan            🔍 ⚙ │
├─────────────────────────┤
│                         │
│  Featured Reciters      │
│  ┌──────┐ ┌──────┐     │
│  │      │ │      │     │
│  │Husary│ │Minsh.│ ... │
│  └──────┘ └──────┘     │
│                         │
│  Continue Listening     │
│  ┌─────────────────┐   │
│  │ ▶ Al-Baqarah    │   │
│  │   Al-Husary     │   │
│  └─────────────────┘   │
│                         │
│  All Surahs             │
│  1. Al-Fatiha      ▶   │
│  2. Al-Baqarah     ▶   │
│  3. Aal-Imran      ▶   │
│  ...                    │
│                         │
├─────────────────────────┤
│ ▶ Al-Baqarah  ━━●━━━━  │
├─────────────────────────┤
│ 🏠  🎙  📖  📕  ⬇      │
└─────────────────────────┘
```

### URL Structure & SEO

Every page is server-rendered and indexable:

| URL | Page | SEO Title |
|-----|------|-----------|
| `/` | Home | Bayaan — Listen to the Holy Quran |
| `/reciters` | All reciters | Quran Reciters — Bayaan |
| `/reciters/al-husary` | Reciter detail | Sheikh Al-Husary — Bayaan |
| `/surah/2` | Surah page | Surah Al-Baqarah — Listen Online — Bayaan |
| `/surah/2?reciter=al-husary` | Surah + reciter | Al-Baqarah by Al-Husary — Bayaan |
| `/mushaf` | Mushaf viewer | Read the Holy Quran — Bayaan |
| `/mushaf/604` | Mushaf page N | Quran Page 604 — Bayaan |
| `/queue` | Queue | Queue — Bayaan |
| `/settings` | Settings | Settings — Bayaan |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `→` | Seek forward 10s |
| `←` | Seek backward 10s |
| `Shift + →` | Next track |
| `Shift + ←` | Previous track |
| `↑` / `↓` | Volume up / down |
| `M` | Mute / unmute |
| `Q` | Toggle queue panel |
| `F` | Toggle full-screen player |
| `/` | Focus search |

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| WEB-01 | Browse all reciters with images, names, and metadata | Must |
| WEB-02 | Browse all 114 surahs with metadata | Must |
| WEB-03 | Play any surah by any reciter | Must |
| WEB-04 | Persistent player bar with play/pause/seek/next/prev | Must |
| WEB-05 | Queue management (add, remove, reorder) | Must |
| WEB-06 | Volume control | Must |
| WEB-07 | Playback speed control (0.5x–2.0x) | Must |
| WEB-08 | Dark mode / light mode toggle + system preference | Must |
| WEB-09 | Responsive layout (desktop, tablet, mobile) | Must |
| WEB-10 | Shareable URLs for every surah and reciter | Must |
| WEB-11 | Server-side rendering for SEO | Must |
| WEB-12 | Ambient nature sounds | Should |
| WEB-13 | Digital Mushaf viewer (Uthmani pages) | Should |
| WEB-14 | Keyboard shortcuts for playback | Should |
| WEB-15 | Media Session API (OS-level play/pause, lock screen) | Should |
| WEB-16 | Search (surahs, reciters) | Should |
| WEB-17 | PWA support (installable, offline cached surahs) | Should |
| WEB-18 | Arabic / English language toggle | Should |
| WEB-19 | RTL layout support for Arabic UI | Should |
| WEB-20 | Continue listening (persist last played across sessions) | Should |
| WEB-21 | Download indicator for cached/offline surahs | Could |
| WEB-22 | Embeddable player widget for external sites | Could |
| WEB-23 | Social sharing meta tags (Open Graph, Twitter cards) | Should |
| WEB-24 | Mushaf page synced with audio playback position | Could |

### Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| WEB-NF-01 | First Contentful Paint < 1.5s | Must |
| WEB-NF-02 | Largest Contentful Paint < 2.5s | Must |
| WEB-NF-03 | Cumulative Layout Shift < 0.1 | Must |
| WEB-NF-04 | Lighthouse Performance score > 90 | Should |
| WEB-NF-05 | Lighthouse Accessibility score > 95 | Must |
| WEB-NF-06 | Works in all modern browsers (Chrome, Firefox, Safari, Edge) | Must |
| WEB-NF-07 | Fully responsive from 320px to 2560px+ | Must |
| WEB-NF-08 | Audio starts playing in < 1s after user presses play | Must |
| WEB-NF-09 | PWA passes Chrome installability criteria | Should |
| WEB-NF-10 | Page weight < 500KB initial load (excluding audio) | Should |

## Design System

### Borrowed from Mobile App

The web app should feel like the same product, not a different app:

| Token | Mobile Value | Web Implementation |
|-------|-------------|-------------------|
| Primary font | Manrope | `font-family: 'Manrope', sans-serif` |
| Arabic font | Scheherazade New | `font-family: 'Scheherazade New', serif` |
| Surah name font | surah_names.ttf | Custom `@font-face` |
| Dark background | `theme.colors.background` | CSS variable `--color-bg` |
| Text primary | `theme.colors.text` | CSS variable `--color-text` |
| Text secondary | `theme.colors.textSecondary` | CSS variable `--color-text-secondary` |
| No accent/primary colors on UI | Convention from CLAUDE.md | Stick to text/textSecondary + alpha variants |
| Border radius | Consistent rounded corners | Tailwind `rounded-xl` / `rounded-2xl` |
| Spacing scale | 4/8/12/16/24/32 | Tailwind default scale |

### Web-Specific Design

| Element | Approach |
|---------|----------|
| Sidebar navigation | 240px width, collapsible, icon-only on collapse |
| Player bar | Fixed bottom, 80px height, full-width |
| Cards | CSS Grid, responsive columns (1-col mobile, 2-3 tablet, 4-5 desktop) |
| Modals / panels | Slide-over panels from right (queue, ambient, settings) |
| Hover states | Subtle background highlight, cursor pointer |
| Focus states | Visible focus rings for keyboard navigation |
| Transitions | 150-200ms ease, no jarring jumps |

## Implementation Phases

### Phase 1: Foundation & Core Playback

1. Next.js project setup with App Router, Tailwind CSS, TypeScript
2. Cloudflare Pages deployment pipeline (wrangler, `@opennextjs/cloudflare`)
3. Root layout: sidebar navigation + persistent player bar
4. Responsive breakpoints (mobile, tablet, desktop)
5. Dark mode / light mode with system preference detection
6. AudioService: HTML5 Audio wrapper with play/pause/seek/volume
7. Zustand stores: playerStore, queueStore (ported from mobile)
8. Home page: featured reciters, continue listening
9. Reciter grid page with Supabase data
10. Reciter detail page with surah list
11. Basic surah playback: click surah → audio plays in player bar
12. Media Session API integration (OS-level controls)

**Exit criteria:** User can browse reciters, select a surah, and play it with full controls.

### Phase 2: Full Player & Queue

1. Full-screen expanded player view (click player bar to expand)
2. Queue panel (slide-over from right)
3. Add to queue / play next / play last
4. Queue reordering (drag and drop)
5. Playback speed control
6. Next/previous track with queue integration
7. Auto-advance to next surah
8. Keyboard shortcuts for playback
9. Progress persistence (localStorage — resume where you left off)

### Phase 3: Surah Pages & SEO

1. Individual surah pages (`/surah/[id]`) with server-rendered metadata
2. Reciter selector on surah page (choose which reciter to listen to)
3. Open Graph meta tags and Twitter cards for social sharing
4. Structured data (JSON-LD) for Google rich results
5. Sitemap generation (all surahs, all reciters)
6. Search functionality (client-side fuzzy search with Fuse.js)
7. Arabic/English language toggle with RTL support

### Phase 4: Ambient Sounds

1. AmbientService: second `Audio()` instance for nature sounds
2. Bundle ambient MP3s (same 8 sounds from mobile app)
3. Ambient sound selector panel
4. Independent volume control
5. Ambient syncs with main playback (pause/resume together)
6. Ambient preference persisted in localStorage

### Phase 5: Digital Mushaf

1. Mushaf page viewer (`/mushaf/[page]`)
2. Uthmani page rendering (CSS-based or Canvas-based)
3. Page navigation (swipe on mobile, arrow keys on desktop, buttons)
4. Page thumbnails or page number input for quick navigation
5. Surah/Juz index for jumping to specific content
6. Integration with audio: tap to play from a specific page
7. (Stretch) Highlight current ayah during playback using timestamp data

### Phase 6: PWA & Offline

1. Service Worker registration
2. App shell caching (HTML, CSS, JS, fonts)
3. Runtime caching strategy for audio files (Cache First for downloaded, Network First for streaming)
4. "Save offline" button for surahs (caches audio in Cache API)
5. Offline indicator UI
6. PWA manifest (installable on desktop and mobile browsers)
7. Splash screen and app icons for PWA

### Phase 7: Polish & Launch

1. Performance optimization (bundle splitting, image optimization, lazy loading)
2. Lighthouse audit pass (performance > 90, accessibility > 95)
3. Cross-browser testing (Chrome, Firefox, Safari, Edge)
4. Mobile Safari audio quirks (autoplay restrictions, audio session handling)
5. Analytics integration
6. Error tracking (Sentry or similar)
7. DNS + SSL setup for thebayaan.com on Cloudflare
8. Launch

## Hosting & Deployment

### Cloudflare Pages

```
bayaan-web/
├── wrangler.toml              # Cloudflare Pages config
├── next.config.ts             # Next.js config
└── ...
```

**Deployment flow:**
1. Push to `main` branch → Cloudflare Pages auto-deploys to thebayaan.com
2. Push to `develop` / feature branches → Preview deployments at `*.bayaan-web.pages.dev`
3. `@opennextjs/cloudflare` adapter converts Next.js output to Cloudflare Workers

**Cloudflare benefits:**
- Global edge CDN (300+ cities, strong MENA/Asia presence)
- Free SSL
- Free tier: 500 builds/month, unlimited bandwidth
- Web Analytics (privacy-focused, no cookie banner needed)
- R2 storage available if needed for audio caching at edge

### Domain Setup

| Domain | Purpose |
|--------|---------|
| `thebayaan.com` | Primary web app |
| `www.thebayaan.com` | Redirect to `thebayaan.com` |
| `api.thebayaan.com` | (Future) API if needed beyond Supabase |

## Open Questions

1. **Shared package for types/data** — Should a shared npm package or Git submodule hold types, surahs.json, reciters.json, and i18n strings between mobile and web repos? Or just copy and sync manually?
2. **User accounts** — The mobile app doesn't have user auth. Should the web version? Could enable cross-device sync (bookmarks, listening history, queue).
3. **Mushaf rendering approach** — Port the Digital Khatt rendering from mobile (Skia-based) to web (Canvas/SVG/CSS)? Or use a different rendering approach optimized for web?
4. **Audio CDN** — Should audio files be proxied through Cloudflare R2/CDN for faster delivery, or continue serving directly from Supabase Storage?
5. **Analytics** — Cloudflare Web Analytics (privacy-first) vs. Plausible vs. PostHog?
6. **Component library** — Build from scratch with Tailwind, or use a headless library (Radix UI, Headless UI) for modals, dropdowns, sliders?

## References

- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Media Session API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API)
- [HTML5 Audio API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/HTMLAudioElement)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [@opennextjs/cloudflare](https://github.com/opennextjs/opennextjs-cloudflare)
- [Service Workers (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest (MDN)](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Bayaan Mobile App — TV Feature Doc](./tv-app.md)
- [Bayaan Mobile App — Smartwatch Feature Doc](./smartwatch.md)

---

*Created: 2026-02-21*
