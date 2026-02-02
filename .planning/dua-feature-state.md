# Dua Feature Implementation State

**Branch:** `feature/dua-feature`
**GitHub Issue:** #67
**Last Updated:** 2026-02-02

---

## Checklist

### Phase 1: Setup & Foundation
- [x] Create feature branch
- [x] Install expo-audio dependency
- [x] Copy duas.json to data/
- [x] Copy 267 audio files to assets/audio/duas/
- [x] Create type definitions (types/dua.ts)

### Phase 2: Database Layer
- [ ] Create DuaDatabaseService (services/database/DuaDatabaseService.ts)
- [ ] Create DuaService (services/dua/DuaService.ts)
- [ ] Register services in AppInitializer

### Phase 3: State Management
- [ ] Create duaStore (store/duaStore.ts)
- [ ] Create useDuas hook (hooks/useDuas.ts)

### Phase 4: Audio Integration
- [x] Create audio asset mapping (utils/duaAudio.ts)
- [ ] Create useDuaAudio hook (hooks/useDuaAudio.ts)

### Phase 5: UI Components
- [ ] Update TabSelector for 3 tabs (components/TabSelector.tsx)
- [ ] Create CategoryCard (components/duas/CategoryCard.tsx)
- [ ] Create DuaListItem (components/duas/DuaListItem.tsx)
- [ ] Create DuaReader (components/duas/DuaReader.tsx)
- [ ] Create DuaAudioControls (components/duas/DuaAudioControls.tsx)
- [ ] Create TasbeehCounter (components/duas/TasbeehCounter.tsx)

### Phase 6: Views & Screens
- [ ] Create DuasView (components/DuasView.tsx)
- [ ] Update Home Screen (app/(tabs)/(a.home)/index.tsx)
- [ ] Create duas route layout (app/(tabs)/(a.home)/duas/_layout.tsx)
- [ ] Create CategoryDetailScreen (app/(tabs)/(a.home)/duas/[categoryId].tsx)
- [ ] Create DuaDetailScreen (app/(tabs)/(a.home)/duas/dua/[duaId].tsx)

### Phase 7: Polish
- [ ] Add tag color mapping (constants/duaColors.ts)
- [ ] Run lint and fix issues
- [ ] Test end-to-end functionality

---

## Completed Files

| File | Description | Commit |
|------|-------------|--------|
| `types/dua.ts` | Type definitions | pending |
| `utils/duaAudio.ts` | Audio asset mapping (267 files) | pending |
| `data/duas.json` | Seed data (132 categories, 267 duas) | pending |
| `assets/audio/duas/` | 267 MP3 files (36MB) | pending |

---

## Key Context for Agents

### Data Structure
- **Categories:** 132 total, grouped by 12 broad tags
- **Duas:** 267 total, each with arabic, translation, transliteration, instruction
- **Audio:** 267 MP3 files at 48kbps mono, named `dua_{id}.mp3`

### Broad Tags (for grouping)
`daily`, `prayer`, `protection`, `health`, `travel`, `food`, `social`, `nature`, `spiritual`, `home`, `clothing`, `general`

### Codebase Patterns to Follow

**Database Service Pattern (from DatabaseService.ts):**
- Singleton with idempotent init via mutex
- WAL mode for concurrent access
- Snake_case in DB, camelCase in TypeScript

**Zustand Store Pattern (from playlistsStore.ts):**
- Database-backed, no persist middleware
- Include `loading` and `error` states
- Actions call service, then update state

**Component Pattern:**
- Props interface at top
- Use `useTheme()` for colors
- Use `moderateScale()` for sizing
- Memoize with `React.memo()` where needed

### expo-audio Usage
```typescript
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

const player = useAudioPlayer(source);
const status = useAudioPlayerStatus(player);

// Methods: player.play(), player.pause(), player.seekTo(seconds)
// Status: status.playing, status.currentTime, status.duration, status.isLoaded
```

### Daily Reset Logic for Tasbeeh
```typescript
function shouldResetCount(lastUpdated: number): boolean {
  const last = new Date(lastUpdated);
  const now = new Date();
  return last.toDateString() !== now.toDateString();
}
```

---

## File Paths Reference

- Types: `/Users/osmansaeday/Bayaan/Bayaan/types/dua.ts`
- Database Service: `/Users/osmansaeday/Bayaan/Bayaan/services/database/DuaDatabaseService.ts`
- Dua Service: `/Users/osmansaeday/Bayaan/Bayaan/services/dua/DuaService.ts`
- Store: `/Users/osmansaeday/Bayaan/Bayaan/store/duaStore.ts`
- Audio Hook: `/Users/osmansaeday/Bayaan/Bayaan/hooks/useDuaAudio.ts`
- Components: `/Users/osmansaeday/Bayaan/Bayaan/components/duas/`
- Screens: `/Users/osmansaeday/Bayaan/Bayaan/app/(tabs)/(a.home)/duas/`
