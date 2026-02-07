# Feature: Ambient Sounds

**Status:** Planned (Post v1.0)
**Priority:** Medium
**Complexity:** Medium
**Created:** 2026-01-29

## Overview

Add the ability to play ambient nature sounds (birds chirping, rain, wind, ocean waves, etc.) in the background while Quran recitation plays. This creates a more immersive and peaceful listening experience.

## User Story

As a user listening to Quran recitation, I want to optionally enable ambient nature sounds that play softly in the background, so that I can create a more peaceful and focused listening environment.

## Technical Feasibility

**Confirmed:** react-native-audio-api (Web Audio API) natively supports multiple simultaneous audio sources.

From the [official documentation](https://docs.swmansion.com/react-native-audio-api/):
- "Easily manage multiple audio streams – play, stop, and synchronize with precision"
- "The Audio API doesn't impose any strict limits on how many source or processing nodes you can create and use simultaneously"
- Multiple AudioBufferSourceNode instances can connect to the same AudioContext.destination

### Audio Graph Architecture

```
┌─────────────────────────┐     ┌────────────┐
│ QuranSourceNode         │────▶│ QuranGain  │────┐
│ (Recitation audio)      │     │ (vol: 1.0) │    │
└─────────────────────────┘     └────────────┘    │
                                                   ▼
                                        ┌─────────────────┐
                                        │  destination    │ ──▶ 🔊
                                        │  (speakers)     │
                                        └─────────────────┘
                                                   ▲
┌─────────────────────────┐     ┌────────────┐    │
│ AmbientSourceNode       │────▶│AmbientGain │────┘
│ (Nature sounds)         │     │ (vol: 0.3) │
│ loop: true              │     └────────────┘
└─────────────────────────┘
```

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| AMB-01 | User can enable/disable ambient sounds during playback | Must |
| AMB-02 | User can select from multiple ambient sound options | Must |
| AMB-03 | User can adjust ambient sound volume independently | Must |
| AMB-04 | Ambient sounds loop seamlessly | Must |
| AMB-05 | Ambient sounds pause/resume with Quran playback | Must |
| AMB-06 | Ambient preference persists across sessions | Should |
| AMB-07 | Ambient sounds work in background mode | Should |
| AMB-08 | User can preview ambient sounds before selecting | Could |

### Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| AMB-NF-01 | Ambient audio adds <5% CPU overhead | Must |
| AMB-NF-02 | Ambient buffers use <10MB memory | Should |
| AMB-NF-03 | Seamless loop with no audible gap | Must |
| AMB-NF-04 | Volume crossfade for smooth enable/disable | Should |

## Available Ambient Sounds

Final set of 8 ambient sounds:

| Sound | Description | Duration | Size Est. | Source |
|-------|-------------|----------|-----------|--------|
| Rain | Gentle rainfall | 2-3 min loop | ~3MB | Freesound (Arctura) |
| Forest | Birds + leaves + subtle wildlife | 2-3 min loop | ~3MB | Freesound (Imjeax) |
| Ocean | Ocean waves on shore | 2-3 min loop | ~3MB | Mixkit |
| Stream | Flowing water/creek | 2-3 min loop | ~3MB | Zapsplat |
| Night | Crickets and evening sounds | 2-3 min loop | ~3MB | Pixabay |
| Thunder | Rain + distant thunder | 2-3 min loop | ~3MB | Freesound (Arctura) |
| Fireplace | Crackling fire | 2-3 min loop | ~3MB | Pixabay |
| Wind | Soft breeze through trees | 2-3 min loop | ~3MB | Zapsplat |

**Note:** All sounds are royalty-free and carefully selected to complement Quran recitation without distraction.

## Architecture Integration

### Modified Components

#### 1. AudioService Extension

```typescript
// New ambient state in AudioService
interface AmbientState {
  sourceNode: AudioBufferSourceNode | null;
  gainNode: GainNode | null;
  buffer: AudioBuffer | null;
  isEnabled: boolean;
  volume: number; // 0-1
  currentSound: AmbientSoundType | null;
}

// New methods
loadAmbientSound(soundType: AmbientSoundType): Promise<void>
setAmbientEnabled(enabled: boolean): void
setAmbientVolume(volume: number): void
```

#### 2. BufferManager Extension

```typescript
// Separate cache for ambient sounds (smaller files, can cache more)
private ambientCache: Map<AmbientSoundType, AudioBuffer>

loadAmbientBuffer(soundType: AmbientSoundType): Promise<AudioBuffer>
```

#### 3. New Store Slice: ambientStore

```typescript
interface AmbientStore {
  // State
  isEnabled: boolean;
  currentSound: AmbientSoundType | null;
  volume: number;
  availableSounds: AmbientSoundType[];

  // Actions
  setEnabled: (enabled: boolean) => void;
  setSound: (sound: AmbientSoundType) => void;
  setVolume: (volume: number) => void;
}
```

#### 4. BackgroundManager Updates

- Ambient pauses with interruption handling
- No separate lock screen metadata for ambient (show only Quran info)
- Both audio streams pause on phone call

### New Components

#### AmbientSoundPicker

A bottom sheet modal with a 2-column grid for selecting ambient sounds:

```typescript
interface AmbientSoundPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (sound: AmbientSoundType) => void;
  currentSound: AmbientSoundType | null;
}
```

**UI Decisions:**
- **Layout:** 2-column grid of cards
- **Card content:** Custom image + label for each sound
- **Selection behavior:** Tap immediately switches to the sound (no preview step)
- **Volume control:** Separate slider at bottom of picker (independent from Quran volume)
- **Selected state:** Highlighted border on active sound card

```
┌─────────────────────────────────────┐
│  Ambient Sounds                  ✕  │
├─────────────────────────────────────┤
│   ┌─────────┐  ┌─────────┐          │
│   │ [img]   │  │ [img]   │          │
│   │  Rain   │  │ Forest  │          │
│   └─────────┘  └─────────┘          │
│   ┌─────────┐  ┌─────────┐          │
│   │ [img]   │  │ [img]   │          │
│   │  Ocean  │  │ Stream  │          │
│   └─────────┘  └─────────┘          │
│   ┌─────────┐  ┌─────────┐          │
│   │ [img]   │  │ [img]   │          │
│   │  Night  │  │ Thunder │          │
│   └─────────┘  └─────────┘          │
│   ┌─────────┐  ┌─────────┐          │
│   │ [img]   │  │ [img]   │          │
│   │Fireplace│  │  Wind   │          │
│   └─────────┘  └─────────┘          │
│  ─────────────────────────────────  │
│  Volume                       🔊    │
│  ━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━  │
└─────────────────────────────────────┘
```

#### AmbientControls

Toggle in main player controls:

```typescript
// Toggle button with volume slider
interface AmbientControlsProps {
  isEnabled: boolean;
  volume: number;
  onToggle: () => void;
  onVolumeChange: (volume: number) => void;
  onSoundPress: () => void; // Opens picker
}
```

**Placement:** In main player controls (always visible when player is open)

## Implementation Phases

### Phase A: Core Infrastructure

1. Extend AudioService with ambient playback capability
2. Add GainNode creation for both Quran and ambient sources
3. Implement ambient source node lifecycle (create, start, stop, loop)
4. Add ambient buffer loading to BufferManager
5. Create ambientStore for state management

### Phase B: Sync & Control

1. Sync ambient pause/resume with Quran playback
2. Handle seek (ambient continues, doesn't seek)
3. Handle track change (ambient continues)
4. Handle queue end (ambient stops)
5. Integrate with interruption handling

### Phase C: UI Implementation

1. Add ambient toggle to player controls
2. Create AmbientSoundPicker component
3. Add volume slider for ambient
4. Persist ambient preferences
5. Add ambient sounds to app bundle

### Phase D: Polish

1. Implement smooth volume crossfade for enable/disable
2. Ensure seamless loop (may need specific audio editing)
3. Test memory and battery impact
4. Test on various devices

## Asset Requirements

### Audio Files

- Format: MP3 (128kbps sufficient for ambient)
- Duration: 2-3 minutes minimum for seamless loop
- Mastering: Consistent volume levels, clean loop points
- Source: Royalty-free libraries (freesound.org, pixabay, etc.)

### UI Assets

- Icons for each ambient sound type
- Toggle icon for ambient on/off
- Volume slider styling

## Open Questions (Resolved)

1. **Bundle vs Download:** ✅ Bundle with app (~24MB for 8 sounds)
   - Immediate availability, no download UI needed

2. **Playback Rate Sync:** ✅ NO - Keep ambient at 1.0x always
   - Birds/rain at 1.5x would sound unnatural

3. **Queue End Behavior:** TBD - Options:
   - Stop immediately
   - Fade out over 3-5 seconds
   - Continue until user manually stops

4. **Lock Screen Display:** TBD - Options:
   - Just Quran info (recommended)
   - "Surah Name + 🌧️" indicator

## Dependencies

- **Requires:** v1.0 Audio Player Migration complete (react-native-audio-api fully integrated)
- **Blocked by:** Phase 5 of current migration

## Success Criteria

1. User can enable ambient sounds from player UI
2. Ambient plays simultaneously with Quran at independent volume
3. Ambient loops seamlessly with no audible gap
4. Ambient pauses/resumes with Quran playback
5. Ambient preference persists across app restarts
6. No noticeable battery or performance impact
7. Works correctly in background mode

## References

- [react-native-audio-api docs](https://docs.swmansion.com/react-native-audio-api/)
- [Web Audio API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [GainNode docs](https://docs.swmansion.com/react-native-audio-api/docs/effects/gain-node/)
- [AudioBufferSourceNode docs](https://docs.swmansion.com/react-native-audio-api/docs/sources/audio-buffer-source-node/)

---

*Created: 2026-01-29*
*Last updated: 2026-02-02*
