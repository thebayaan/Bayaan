# Android Floating Tab Bar + Redesigned Floating Player

## Context
iOS uses NativeTabs with a polished MiniPlayer as a BottomAccessory. Android currently has an edge-to-edge custom `BottomTabBar` and a boxy `FloatingPlayer`. This redesign brings the Android UI to parity with iOS's visual polish using our alpha-based design system.

## Design

### Floating Tab Bar
- **Shape**: Pill with `borderRadius: ~24`, horizontal margins `~16px`
- **Background**: `Color(theme.colors.text).alpha(0.04)` + `borderColor: alpha(0.06)` + `borderWidth: 1`
- **Shadow**: Low elevation for subtle depth
- **Labels**: Kept — icon + label per tab, same fonts (Manrope-Medium, ms(10))
- **Active state**: Filled icon variant + slightly bolder label, no background highlight
- **Position**: Absolute, `~12px` above bottom safe area inset
- **No change to tab count or behavior** — same 4 tabs (Home, Search, Collection, Settings)

### Floating Player
- **Same visual language** as tab bar: matching borderRadius, horizontal margins, alpha background
- **Layout**: `[Reciter Image 40x40 rounded] [Surah Name / Reciter Name] [Play Button]`
- **Removed**: Love button, surah glyph, progress bar
- **No appear/disappear animation** — conditionally rendered (immediate show/hide)
- **Tap**: Opens full player sheet (existing behavior)
- **Position**: Absolute, positioned above floating tab bar with gap

### Spacing & Constants
- `FLOATING_TAB_BAR_MARGIN_BOTTOM`: `~12px` from bottom edge
- `FLOATING_TAB_BAR_HORIZONTAL_MARGIN`: `~16px`
- Player sits above tab bar with `~8px` gap
- `TOTAL_BOTTOM_PADDING` recalculated for content scroll clearance
- Both player and tab bar share same horizontal margins for visual alignment

### Color Tokens (from design system)
| Element | Token |
|---------|-------|
| Background | `Color(theme.colors.text).alpha(0.04)` |
| Border | `Color(theme.colors.text).alpha(0.06)` |
| Icon (inactive) | `Color(theme.colors.text).alpha(0.5)` |
| Icon (active) | `theme.colors.text` |
| Label (inactive) | `Color(theme.colors.text).alpha(0.5)` |
| Label (active) | `Color(theme.colors.text).alpha(0.85)` |
| Player text primary | `Color(theme.colors.text).alpha(0.85)` |
| Player text secondary | `Color(theme.colors.textSecondary).alpha(0.45)` |

### Files Affected
- `components/BottomTabBar.tsx` — Redesign to floating pill
- `components/player/v2/FloatingPlayer/index.tsx` — Redesign layout (artwork, simplified)
- `utils/constants.ts` — Update spacing constants
- `app/(tabs)/_layout.tsx` — Adjust positioning if needed
