# Feature: Apple TV & Android TV Support

**Status:** Proposal
**Priority:** Low
**Complexity:** High
**Created:** 2026-02-20

## Overview

Extend Bayaan to run on Apple TV (tvOS) and Android TV platforms, allowing users to listen to Quran recitations on their television with a remote-friendly, 10-foot UI experience.

## User Story

As a user, I want to use Bayaan on my Apple TV or Android TV so that I can listen to Quran recitations in my living room with a beautiful, large-screen interface navigable by remote control.

## Platform Requirements

### Apple TV (tvOS)

- Requires the [`react-native-tvos`](https://github.com/react-native-tvos/react-native-tvos) fork of React Native
- Expo does not natively support tvOS — requires custom native configuration via `expo prebuild` with patched native projects, or a bare workflow
- Minimum tvOS version: 16.0+

### Android TV

- Android TV is a variant of Android — React Native apps can run with modifications
- `react-native-tvos` fork also provides Android TV focus engine support
- Minimum Android TV API level: 28 (Android 9)

## Technical Feasibility

### What Can Be Reused (Shared Core)

| Layer | Reusable? | Notes |
|-------|-----------|-------|
| Zustand stores | Yes | State management is platform-agnostic |
| ExpoAudioService | Mostly | Needs tvOS compatibility verification |
| AmbientAudioService | Mostly | Same as above |
| Data layer (reciters.json, surahs.json) | Yes | Static data, no changes needed |
| Supabase fetching / download service | Yes | Network layer is platform-agnostic |
| i18n (react-i18next) | Yes | Works unchanged |
| Custom hooks (usePlayerActions, etc.) | Yes | Business logic hooks are reusable |
| TypeScript types | Yes | Fully reusable |
| Utility functions | Yes | Fully reusable |

### What Must Be Rebuilt (TV UI Layer)

| Component | Reason |
|-----------|--------|
| Navigation (Expo Router tabs) | Bottom tabs don't work on TV; needs side rail or top bar |
| All interactive components | Must support focus-based navigation (D-pad/remote) |
| Bottom sheets (ambient, queue) | Not usable on TV; replace with full-screen overlays or side panels |
| Gesture interactions (swipe, long-press) | Not available on TV; need button/remote alternatives |
| Player bar | Needs full-screen player view for TV |
| List/grid layouts | Must use large cards with visible focus states |
| Text sizing | All text needs to be larger for 10-foot viewing distance |

### Dependencies to Evaluate

| Dependency | TV Compatible? | Notes |
|------------|---------------|-------|
| expo-audio | Unknown | Needs testing on tvOS; may need native patches |
| expo-router | Partial | File-based routing works, but tab layout needs replacement |
| @gorhom/bottom-sheet | No | Not suitable for TV; replace with modals |
| react-native-reanimated | Yes | Works on TV platforms |
| react-native-gesture-handler | Partial | Touch gestures N/A; focus handler support exists |
| expo-image | Unknown | Needs testing on tvOS |
| react-native-mmkv | Yes | Storage layer works on TV |
| moti | Yes | Animation library, platform-agnostic |

## Architecture

### Recommended Approach: Monorepo with Shared Core

```
bayaan/
├── packages/
│   ├── core/                  # Shared business logic
│   │   ├── stores/            # Zustand stores
│   │   ├── services/          # Audio, downloads, etc.
│   │   ├── hooks/             # Shared hooks
│   │   ├── types/             # TypeScript types
│   │   ├── data/              # Static data
│   │   └── utils/             # Utilities
│   ├── mobile/                # Current mobile app (iOS + Android)
│   │   ├── app/               # Expo Router screens
│   │   └── components/        # Mobile-specific components
│   └── tv/                    # TV app (tvOS + Android TV)
│       ├── app/               # TV screen layouts
│       └── components/        # TV-specific components
```

Alternatively, if monorepo is too much overhead initially, a simpler approach:

```
Bayaan/
├── app/
│   ├── (tabs)/               # Mobile tab layout
│   └── (tv)/                 # TV layout (side rail navigation)
├── components/
│   ├── shared/               # Platform-agnostic components
│   ├── mobile/               # Mobile-specific
│   └── tv/                   # TV-specific (focus-aware)
```

### Focus Navigation System

TV platforms use a **focus engine** instead of touch. Every interactive element must:

1. Be **focusable** — register with the TV focus engine
2. Have a **focused state** — visual indicator (border, scale, glow)
3. Support **directional navigation** — up/down/left/right moves focus
4. Handle **select** — equivalent to tap/press
5. Handle **back/menu** — equivalent to back navigation

```typescript
// TV-aware pressable wrapper
interface TVPressableProps {
  onPress: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  hasTVPreferredFocus?: boolean;
  children: React.ReactNode;
}
```

React Native's built-in `Pressable` supports TV focus out of the box when using `react-native-tvos`. The focus engine is enabled automatically.

### TV Navigation Structure

```
┌──────────────────────────────────────────────────┐
│  ┌──────┐                                        │
│  │      │  ┌────────────────────────────────────┐│
│  │ Home │  │                                    ││
│  │      │  │                                    ││
│  ├──────┤  │         Content Area               ││
│  │      │  │                                    ││
│  │Recitr│  │   (Horizontal scrolling rows       ││
│  │      │  │    of large cards)                  ││
│  ├──────┤  │                                    ││
│  │      │  │                                    ││
│  │Surah │  │                                    ││
│  │      │  │                                    ││
│  ├──────┤  │                                    ││
│  │      │  │                                    ││
│  │ Now  │  │                                    ││
│  │Playin│  │                                    ││
│  │      │  └────────────────────────────────────┘│
│  └──────┘                                        │
│  ┌──────────────────────────────────────────────┐│
│  │  Now Playing: Surah Al-Baqarah — Al-Husary   ││
│  │  ━━━━━━━━━━━━━●━━━━━━━━━━━  02:34 / 45:12   ││
│  └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

- **Left rail**: Replaces bottom tabs — Home, Reciters, Surahs, Now Playing
- **Content area**: Large cards in horizontal rows, focus-navigable
- **Bottom bar**: Persistent now-playing info (not interactive unless focused)

### TV Player View

Full-screen player replaces the mobile bottom-sheet player:

```
┌──────────────────────────────────────────────────┐
│                                                  │
│              ┌──────────────┐                    │
│              │              │                    │
│              │  Reciter     │                    │
│              │  Image       │                    │
│              │              │                    │
│              └──────────────┘                    │
│                                                  │
│           Surah Al-Baqarah                       │
│           Sheikh Al-Husary                       │
│           Hafs A'n Asim — Murattal               │
│                                                  │
│     ━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━              │
│     02:34                         45:12          │
│                                                  │
│       ⏮     ◀◀     ▶ ❚❚     ▶▶     ⏭            │
│                                                  │
│    [Queue]  [Ambient]  [Speed]  [Download]       │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Remote Control Mapping

| Remote Button | Action |
|---------------|--------|
| Up/Down/Left/Right | Navigate focus between elements |
| Select (center click) | Activate focused element (play, select surah, etc.) |
| Play/Pause | Toggle playback (system-level) |
| Menu / Back | Go back / close overlay |
| Siri button (Apple TV) | Voice search for surah or reciter (future) |

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| TV-01 | App launches and runs on Apple TV | Must |
| TV-02 | App launches and runs on Android TV | Must |
| TV-03 | All screens navigable via TV remote (D-pad) | Must |
| TV-04 | Focus states visible on all interactive elements | Must |
| TV-05 | Audio playback works (play, pause, next, prev, seek) | Must |
| TV-06 | Reciter browsing and selection | Must |
| TV-07 | Surah browsing and selection | Must |
| TV-08 | Queue management via overlay/panel | Should |
| TV-09 | Ambient sounds accessible via TV UI | Should |
| TV-10 | Download management for offline playback | Should |
| TV-11 | System media controls (play/pause button on remote) | Must |
| TV-12 | Now Playing info in tvOS/Android TV system UI | Should |
| TV-13 | Deep linking from system search (future) | Could |
| TV-14 | Siri voice search for surahs/reciters (future) | Could |

### Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| TV-NF-01 | UI legible from 10-foot viewing distance | Must |
| TV-NF-02 | Minimum 30fps during navigation and animations | Must |
| TV-NF-03 | Focus transitions smooth (< 100ms) | Must |
| TV-NF-04 | App startup < 5 seconds on modern TV hardware | Should |
| TV-NF-05 | Memory usage < 200MB | Should |

## Implementation Phases

### Phase 0: Research & Proof of Concept

1. Set up `react-native-tvos` in a test branch
2. Verify `expo-audio` works on tvOS
3. Verify `expo-image`, `react-native-reanimated` work on tvOS
4. Build a minimal TV screen with focus navigation
5. Confirm audio playback on Apple TV simulator
6. Document findings and blockers

**Exit criteria:** Audio plays on tvOS simulator, focus navigation works

### Phase 1: Project Structure & Navigation

1. Decide on monorepo vs single-project approach
2. Extract shared core (stores, services, hooks, types) if monorepo
3. Create TV navigation layout (side rail + content area)
4. Implement focus-aware base components (TVPressable, TVCard, TVRow)
5. Set up TV-specific Expo Router layout

### Phase 2: Core Screens

1. **Home screen** — Featured reciters, recently played, continue listening
2. **Reciters screen** — Large card grid, horizontal rows by category
3. **Reciter detail** — Surah list with large focus-friendly rows
4. **Surah list screen** — Browsable surah list with focus navigation

### Phase 3: Player

1. Full-screen TV player view
2. Playback controls with focus navigation
3. Progress bar (seekable via left/right on remote)
4. System media control integration (Now Playing)
5. Queue overlay (accessible from player)

### Phase 4: Secondary Features

1. Ambient sounds overlay
2. Download management
3. Playback speed control
4. Search (text input via on-screen keyboard or voice)

### Phase 5: Polish & Release

1. Focus state animations and transitions
2. Performance optimization for TV hardware
3. Accessibility review
4. TestFlight for tvOS / Internal testing for Android TV
5. App Store / Play Store submission for TV

## Open Questions

1. **Monorepo vs single project?** — Monorepo is cleaner long-term but adds build complexity. Single project with platform checks is simpler to start.
2. **Expo compatibility** — How much of Expo SDK 54 works on tvOS? Need Phase 0 research.
3. **expo-audio on tvOS** — Does it work? Does background audio work on tvOS? Apple TV apps may not "background" the same way.
4. **Mushaf view on TV?** — Should the digital Mushaf be available on TV? Could be a beautiful large-screen experience, but adds significant scope.
5. **App Store guidelines** — Apple TV apps have specific UI/UX requirements. Need to review Apple's tvOS HIG.
6. **Android TV launcher integration** — Channels, recommendations row, etc.

## References

- [react-native-tvos](https://github.com/react-native-tvos/react-native-tvos) — React Native fork with TV support
- [Apple TV Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/designing-for-tvos)
- [Android TV Design Guidelines](https://developer.android.com/design/ui/tv)
- [React Native TV documentation](https://reactnative.dev/docs/building-for-apple-tv)
- [Expo + TV discussion](https://github.com/expo/expo/discussions) — Community efforts

---

*Created: 2026-02-20*
