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


| Variable                     | Required | Description                                                    |
| ---------------------------- | -------- | -------------------------------------------------------------- |
| `EXPO_PUBLIC_BAYAAN_API_URL` | Yes      | Bayaan backend base URL                                        |
| `EXPO_PUBLIC_BAYAAN_API_KEY` | Yes      | API key for reciter data, timestamps, etc.                     |
| `SUPABASE_URL`               | No       | Legacy — only needed if working on Supabase-dependent features |
| `SUPABASE_ANON_KEY`          | No       | Legacy — same as above                                         |


### API key for development

The official app uses a private key. For contributors, use the **community key** which has its own rate limit but is sufficient for building and testing:

```
EXPO_PUBLIC_BAYAAN_API_URL=https://api.thebayaan.com
EXPO_PUBLIC_BAYAAN_API_KEY=<community key>
```

Get the community key from the pinned issue or pinned discussion on GitHub. If you cannot find it, open an issue asking for access.

If no key is set, the app will start but the reciter list will be empty because all reciter and audio data comes from the API.

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