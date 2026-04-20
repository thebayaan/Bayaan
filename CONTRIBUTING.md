# Contributing to Bayaan

Thank you for contributing to Bayaan. This guide covers everything you need to get the app running locally, follow the project's code standards, and submit a pull request.

---

## Table of Contents

1. [Getting started](#getting-started)
2. [Environment variables](#environment-variables)
3. [Development commands](#development-commands)
4. [Code standards](#code-standards)
5. [Design system](#design-system)
6. [AI-assisted development](#ai-assisted-development)
7. [Architecture navigation](#architecture-navigation)
8. [Pull request workflow](#pull-request-workflow)

---

## Getting started

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- iOS: macOS with Xcode 15+
- Android: Android Studio with an emulator

### Clone and install

```bash
git clone https://github.com/thebayaan/Bayaan.git
cd Bayaan
npm install
```

---

## Environment variables

Copy the example file:

```bash
cp .env.example .env
```

`.env.example` documents every variable with inline context. The table below is the quick reference:

| Variable                          | Required | Description                                                                        |
| --------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_BAYAAN_API_URL`      | No       | Bayaan backend base URL. Blank = bundled reciter data only (no API calls).         |
| `EXPO_PUBLIC_BAYAAN_API_KEY`      | No       | API key for reciter data, timestamps, etc. Blank = bundled data.                   |
| `EXPO_PUBLIC_KILLSWITCH_URL`      | No       | Backend-disable check on launch. Blank = skipped (no network call on start).       |
| `APPLE_TEAM_ID`                   | iOS      | Apple Developer Team ID for code signing. Required to build iOS for a device.     |
| `EXPO_PUBLIC_EAS_PROJECT_ID`      | OTA      | EAS project UUID. Blank = OTA updates disabled (no phone-home on launch).          |
| `EXPO_PUBLIC_ASSOCIATED_DOMAIN`   | No       | Universal-link / deep-link host. Blank = no deep-link registration.                |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL`  | Submit   | Shown in the app and required by App Store / Play Store submissions.               |
| `EXPO_PUBLIC_POSTHOG_API_KEY`     | No       | PostHog analytics. Blank = analytics disabled.                                     |
| `EXPO_PUBLIC_SENTRY_DSN`          | No       | Sentry crash reporting. Blank = Sentry skipped entirely, including build plugin.   |
| `EXPO_PUBLIC_ANALYTICS_ENABLED`   | No       | `false` to disable all analytics/crash reporting. Defaults to enabled.             |
| `SUPABASE_URL`                    | No       | Legacy — only needed if working on Supabase-dependent features.                    |
| `SUPABASE_ANON_KEY`               | No       | Legacy — same as above.                                                            |


### API key for development

The app works out of the box with bundled reciter data — no API key required for most development work. Leave `EXPO_PUBLIC_BAYAAN_API_KEY` blank and the app will use the fallback data under `data/reciters-fallback.json`.

The bundled fallback ships **224 reciters sourced from public CDNs** (`mp3quran.net`, `quranicaudio.com`). It is a curated subset of the full catalogue — reciters that were only available via private hosts (R2, Supabase) are excluded, and reciter images are omitted. Live verse-sync timestamps are also unavailable for fallback reciters. This is intentional: forks can build and demo without depending on the maintainer's infrastructure.

If you are working on a feature that needs the live reciter catalogue, timestamp service, or other backend-only data, request a rate-limited **community key** by opening an issue titled "Community API key request". Then set:

```
EXPO_PUBLIC_BAYAAN_API_URL=https://api.thebayaan.com
EXPO_PUBLIC_BAYAAN_API_KEY=<community key>
```

### Running your own fork

The app is designed to run with zero setup against bundled data. To run your own fork against your own infrastructure:

1. **Apple / iOS signing** — set `APPLE_TEAM_ID` to your own Apple Developer Team ID, then run `npx expo prebuild --clean` to regenerate the Xcode project with your team baked in.
2. **EAS Build / OTA** — create your own EAS project (`eas init`), then set `EXPO_PUBLIC_EAS_PROJECT_ID` to the UUID. Leaving this blank disables OTA entirely so your users don't phone home anywhere.
3. **Deep links** — set `EXPO_PUBLIC_ASSOCIATED_DOMAIN` to a domain you control and host the corresponding `.well-known/apple-app-site-association` / `assetlinks.json`. Leave blank to skip deep-link registration.
4. **Privacy policy** — `EXPO_PUBLIC_PRIVACY_POLICY_URL` must point at a page you publish before submitting to either store.
5. **Bundle identifier** — rename `com.bayaan.app` in `app.config.js` and `android/app/build.gradle` to something you own.

---

## Development commands

```bash
# Start the Expo dev server
npm start

# Run on specific platform
npm run ios           # iOS simulator (macOS only)
npm run android       # Android emulator
npm run web           # Web browser

# Linting and formatting
npm run lint          # Check for lint issues
npm run lint:fix      # Auto-fix lint issues
npm run format        # Format all files with Prettier

# Type checking
npx tsc --noEmit      # Check types without emitting

# Tests
npm test              # Run tests in watch mode

# Reset caches
npm run reset-project

# Version management
npm run version:current    # Show current version
npm run version:patch      # Bump patch version (1.0.0 → 1.0.1)
npm run version:minor      # Bump minor version (1.0.0 → 1.1.0)
npm run version:major      # Bump major version (1.0.0 → 2.0.0)
```

### How versioning works (for forks)

The version displayed in `app.config.js` is derived at build time by `scripts/generate-version.js` from Git metadata:

- **Semantic version** = the latest `v*.*.*` Git tag reachable from HEAD (falls back to `package.json.version`, then `1.0.0`)
- **Build number / Android `versionCode`** = `git rev-list --count HEAD` (total commit count, overridable via the `BUILD_NUMBER` env var for CI)
- **Git hash & branch** = embedded for in-app diagnostics

**If you are forking the repo**, be aware:

1. Cloning inherits the full tag history, so your first build will show the last upstream version (e.g. `2.1.2`). To start your own version line:
   ```bash
   git tag -l 'v*' | xargs git tag -d   # remove upstream tags locally
   git tag v1.0.0                       # or whatever starting version makes sense
   ```
2. `npm run version:patch/minor/major` computes the next version from the current tag and creates a new `vX.Y.Z` tag. It does **not** push — run `git push origin vX.Y.Z` when you're ready.
3. Your Android `versionCode` will diverge from upstream because your commit count differs. That's fine for a separate Play Store listing; just don't try to upload to the same store listing as upstream.
4. Shallow CI clones (the default for `actions/checkout@v4`) may miss tags; pass `fetch-depth: 0` or set the `BUILD_NUMBER` env var to get deterministic values.

---

## Code standards

**Before every commit, run:**

```bash
npx prettier --write <changed files>
npx tsc --noEmit
```

Both checks must pass with no new errors.

### TypeScript

- Strict mode is on — no `any` types
- Use interfaces for props and state shapes
- Prefer `React.FC<Props>` for functional components
- Avoid enums; use const maps instead

### Component structure

```typescript
// 1. Props interface
interface MyComponentProps {
  title: string;
  onPress: () => void;
}

// 2. Component
export const MyComponent: React.FC<MyComponentProps> = ({ title, onPress }) => {
  // 3. Hooks at the top
  const theme = useTheme();

  // 4. Handlers in the middle
  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  // 5. Return at the bottom
  return (
    <Pressable onPress={handlePress}>
      <Text>{title}</Text>
    </Pressable>
  );
};
```

### Key rules

- Use `Pressable` instead of `TouchableOpacity` — the opacity flash on tap is unwanted
- Use `FlashList` from `@shopify/flash-list` instead of `FlatList` or `SectionList`
- Use `expo-image` instead of the built-in `Image` component
- Avoid `useEffect`/`useState` when possible — prefer Zustand stores and context
- Use `usePlayerActions` for audio controls, not the deprecated `useUnifiedPlayer`
- Name variables/functions camelCase, components PascalCase, directories lowercase-with-hyphens

---

## Design system

The app uses an alpha-based color system derived from `theme.colors.text` and `theme.colors.textSecondary`. Do not use `theme.colors.primary` or accent colors for UI chrome.

### Color tokens


| Token               | Value                                          | Usage               |
| ------------------- | ---------------------------------------------- | ------------------- |
| Card background     | `Color(theme.colors.text).alpha(0.04)`         | Surface backgrounds |
| Card border         | `Color(theme.colors.text).alpha(0.06)`         | 1px borders         |
| Divider             | `Color(theme.colors.text).alpha(0.06)`         | Hairline separators |
| Pressed state       | `Color(theme.colors.text).alpha(0.06)`         | Pressable feedback  |
| Icon                | `Color(theme.colors.text).alpha(0.7)`          | Secondary icons     |
| Option label        | `Color(theme.colors.text).alpha(0.85)`         | Row labels          |
| Section header      | `Color(theme.colors.textSecondary).alpha(0.5)` | ALL CAPS labels     |
| Primary button bg   | `theme.colors.text`                            | Action buttons      |
| Primary button text | `theme.colors.background`                      | Button labels       |


### Card pattern

```tsx
{
  backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
  borderWidth: 1,
  borderColor: Color(theme.colors.text).alpha(0.06).toString(),
  borderRadius: moderateScale(14),
  overflow: 'hidden',
}
```

Reference implementations: `components/sheets/MushafSettingsContent.tsx`, `components/sheets/VerseActionsSheet.tsx`.

---

## AI-assisted development

AI tools (Cursor, Copilot, Claude, etc.) are welcome and encouraged. See [docs/contributing/ai-guidelines.md](docs/contributing/ai-guidelines.md) for the full policy.

**Summary:**

- All AI-generated code blocks must be marked with `// @ai` at the end of the line (single line) or `// @ai-start` / `// @ai-end` comments wrapping a block
- You are responsible for every line you submit — review and understand AI output before pushing
- The PR template includes an AI disclosure checkbox

---

## Architecture navigation


| What you're looking for | Where to find it                                  |
| ----------------------- | ------------------------------------------------- |
| App startup sequence    | `services/AppInitializer.ts`                      |
| Audio playback engine   | `services/audio/ExpoAudioService.ts`              |
| Audio React bridge      | `services/audio/ExpoAudioProvider.tsx`            |
| Player state            | `services/player/store/playerStore.ts`            |
| Download state          | `services/player/store/downloadStore.ts`          |
| Mushaf rendering        | `services/mushaf/` + `components/mushaf/`         |
| Tab screens             | `app/(tabs)/`                                     |
| Settings screens        | `app/(tabs)/(d.settings)/`                        |
| Shared types            | `types/`                                          |
| Zustand stores          | `store/` (24 modules)                             |
| Constants               | `constants/`                                      |
| Global hooks            | `hooks/`                                          |
| Static data             | `data/` (reciters.json, surahs.json, adhkar.json) |


Full architecture documentation: [docs/architecture/current-state.md](docs/architecture/current-state.md)

---

## Pull request workflow

1. **Branch from `develop`**, never from `main`:
  ```bash
   git checkout develop
   git pull
   git checkout -b feature/your-feature-name
  ```
2. **Branch naming conventions:**
  - `feature/description` — new feature
  - `fix/description` — bug fix
  - `chore/description` — tooling, dependencies, cleanup
  - `docs/description` — documentation only
3. **Before submitting:**
  ```bash
   npx prettier --write .
   npx tsc --noEmit
   # Test on iOS and Android
  ```
4. **Open a PR targeting `develop`** with a clear description of what changed and why.
5. **Keep PRs focused** — one feature or fix per PR. Large scope changes are harder to review and more likely to introduce regressions.

### Commit message format

Use conventional commits:

```
feat: add ambient sound fade-in on play
fix: resolve download progress not reaching 100%
chore: update expo-audio to 55.0.8
docs: update player architecture doc
```

Do not include AI tool names or attributions in commit messages.

---

## Self-hosting

If you want to run Bayaan against your own backend instead of the community API, see the [self-hosting guide](docs/contributing/self-hosting.md).