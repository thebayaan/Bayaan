# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Self-Update Command

When Claude learns something essential about this project that should be remembered for future sessions, use this command:

```bash
# Update CLAUDE.md with new learnings
# Claude should edit this file directly when discovering:
# - New patterns or conventions in the codebase
# - Important configuration details
# - Common issues and their solutions
# - New services or features added
# - Changes to the deployment process
```

**When to update this file:**
- After discovering a non-obvious solution to a problem
- When adding new features that require specific patterns
- After debugging issues that took significant effort to resolve
- When external services or APIs are integrated
- When project conventions are established or changed

---

## Tooling Rules

- **GitHub operations:** Always use the `gh` CLI (e.g., `gh issue create`, `gh pr create`, `gh api`) via Bash. Never use the GitHub MCP server tools — authentication is broken and will fail.

---

## Common Commands

### Development

```bash
# Start the development server
npm start

# Start specific platform
npm run ios        # Run on iOS simulator (macOS only)
npm run android    # Run on Android emulator
npm run web        # Run on web browser

# Reset project (clear caches)
npm run reset-project
```

### Code Quality

**All code written must be both Prettier-formatted and type-checked before committing.**

- Run `npx prettier --write <files>` on all modified files
- Run `npx tsc --noEmit` and ensure no new type errors are introduced

```bash
# Linting
npm run lint       # Check for linting issues
npm run lint:fix   # Fix linting issues

# Formatting
npm run format     # Format all files with Prettier
```

### Testing

```bash
# Run tests in watch mode
npm test
```

### Version Management

```bash
# Check current version
npm run version:current

# Bump version (semantic versioning)
npm run version:patch  # For bug fixes (1.0.0 -> 1.0.1)
npm run version:minor  # For new features (1.0.0 -> 1.1.0)
npm run version:major  # For breaking changes (1.0.0 -> 2.0.0)
```

### Asset Generation

```bash
# Generate reciter images
npm run generate-reciter-images

# Generate app icons
npm run generate-icons

# Fetch reciter data from Supabase
npm run fetch-reciters

# Resize splash images
npm run resize-splash-images
```

---

## Code Style and Conventions

### TypeScript Guidelines

- Write concise, type-safe TypeScript code
- Use functional components and hooks over class components
- Ensure components are modular, reusable, and maintainable
- Organize files by feature, grouping related components, hooks, and styles
- Enable strict typing in `tsconfig.json`
- Avoid using `any`; strive for precise types
- Utilize `React.FC` for defining functional components with props
- Avoid enums; use maps instead
- Use TypeScript interfaces for props and state

### Naming Conventions

- **Variables/Functions**: camelCase (e.g., `isFetchingData`, `handleUserInput`)
- **Components**: PascalCase (e.g., `UserProfile`, `ChatScreen`)
- **Directories**: lowercase with hyphens (e.g., `user-profile`, `chat-screen`)
- **Files**: Match component name for components, camelCase for utilities

### Syntax and Formatting

- Use the `function` keyword for pure functions
- Avoid unnecessary curly braces in conditionals; use concise syntax for simple statements
- Use declarative JSX
- Use Prettier for consistent code formatting

### Component Structure Pattern

Components follow a consistent pattern:
```typescript
// 1. Props interface at the top
interface MyComponentProps {
  title: string;
  onPress: () => void;
}

// 2. Component definition
export const MyComponent: React.FC<MyComponentProps> = ({ title, onPress }) => {
  // 3. Hooks/state near the beginning
  const [isLoading, setIsLoading] = useState(false);
  const theme = useTheme();

  // 4. Helper functions/handlers in the middle
  const handlePress = useCallback(() => {
    setIsLoading(true);
    onPress();
  }, [onPress]);

  // 5. Return statement with JSX at the end
  return (
    <TouchableOpacity onPress={handlePress}>
      <Text>{title}</Text>
    </TouchableOpacity>
  );
};
```

---

## Performance Optimization

### React Native Best Practices

- Minimize `useEffect`, `useState`, and heavy computations inside render methods
- Use `React.memo()` for components with static props to prevent unnecessary re-renders
- Optimize FlatLists with props like `removeClippedSubviews`, `maxToRenderPerBatch`, and `windowSize`
- Use `getItemLayout` for FlatLists when items have a consistent size
- Avoid anonymous functions in `renderItem` or event handlers to prevent re-renders
- Minimize the use of useState and useEffect; prefer context and reducers for state management
- Use Expo's AppLoading and SplashScreen for optimized app startup experience
- Optimize images: use WebP format where supported, implement lazy loading with expo-image
- Profile and monitor performance using React Native's built-in tools and Expo's debugging features
- Use `useMemo` and `useCallback` hooks appropriately

### UI and Styling

- **Use `Pressable` instead of `TouchableOpacity`** — the opacity flash on press is unwanted. Use `Pressable` for all interactive elements.
- Use consistent styling through `StyleSheet.create()`
- Ensure responsive design by considering different screen sizes and orientations
- Optimize image handling using `expo-image`
- Implement responsive design with Flexbox and Expo's `useWindowDimensions`
- Implement dark mode support using Expo's `useColorScheme`
- Ensure high accessibility (a11y) standards using ARIA roles and native accessibility props
- Leverage `react-native-reanimated` and `react-native-gesture-handler` for performant animations

### Safe Area Management

- Use `SafeAreaProvider` from `react-native-safe-area-context` globally
- Wrap top-level components with `SafeAreaView` to handle notches, status bars, and screen insets
- Use `SafeAreaScrollView` for scrollable content
- Avoid hardcoding padding or margins for safe areas

---

## Architecture Overview

Bayaan is a React Native/Expo application for Quran audio playback.

### Tech Stack

- **Framework:** React Native (0.81.5) with Expo SDK 54
- **Navigation:** Expo Router v4 (file-based routing)
- **State Management:** Zustand (4.5.5)
- **Audio:** expo-audio (~1.1.1)
- **Storage:** AsyncStorage, Expo SQLite
- **UI:** @gorhom/bottom-sheet, react-native-reanimated, moti
- **Images:** expo-image (~3.0.11)
- **i18n:** react-i18next

### Core Architecture Components

1. **Expo Router (v4)**: File-based routing system
   - Route files in `/app` directory (similar to Next.js)
   - Nested routes in subdirectories
   - Layout files (`_layout.tsx`) provide shared UI elements

2. **Zustand State Management**:
   - Global stores in `/store` directory
   - Separate stores for different concerns (player, queue, downloads, etc.)
   - Persistent state with AsyncStorage integration

3. **Audio Playback System**:
   - Uses `expo-audio` via `ExpoAudioService` singleton (`services/audio/ExpoAudioService.ts`)
   - React bridge via `ExpoAudioProvider` (`services/audio/ExpoAudioProvider.tsx`)
   - Player state in Zustand (`services/player/store/playerStore.ts`)
   - Custom playback services in `/services/player`

4. **App Initialization** (`services/AppInitializer.ts`):
   - Central orchestrator for all service initialization
   - Priority-based initialization order
   - Critical vs non-critical service handling
   - SQLite services must register here for preloading

### Code Structure

```
Bayaan/
├── app/               # Expo Router screens and layouts
│   ├── (auth)/        # Authentication screens
│   ├── (tabs)/        # Main tab-based screens
│   └── _layout.tsx    # Root layout component
├── assets/            # Static assets (images, fonts)
├── components/        # Reusable UI components
├── constants/         # Constant values used across the app
├── contexts/          # React Context providers
├── data/              # Static data files (reciters.json, surahs.json)
├── docs/              # Documentation
├── hooks/             # Custom React hooks
├── services/          # Global API services/utilities
│   ├── player/        # Audio player service
│   ├── audio/         # expo-audio engine (ExpoAudioService, ExpoAudioProvider)
│   ├── downloadService.ts  # Offline downloads
│   └── AppInitializer.ts   # App startup orchestrator
├── store/             # Zustand state management stores
├── styles/            # Global styles and color schemes
├── theme/             # Theme configuration
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
```

### Key Custom Hooks

- `usePlayerActions`: Zero-re-render action hook for audio controls (preferred)
- `useUnifiedPlayer`: Deprecated shim for audio playback (still works, causes excess renders)
- `useTheme`: Theme context and utilities
- `useReciterNavigation`: Navigation helpers for reciter screens
- `usePlaylists`: Playlist management (preloaded via AppInitializer)
- `useDownloads`: Download management for offline playback

---

## Error Handling and Validation

- Use Zod for runtime validation and error handling
- Handle errors at the beginning of functions
- Use early returns for error conditions to avoid deeply nested if statements
- Avoid unnecessary else statements; use if-return pattern instead
- Implement global error boundaries to catch and handle unexpected errors

---

## Internationalization (i18n)

- Use `react-i18next` for internationalization
- Support multiple languages and RTL layouts
- Ensure text scaling and font adjustments for accessibility

---

## Security

- Sanitize user inputs to prevent XSS attacks
- Use `react-native-encrypted-storage` for secure storage of sensitive data
- Ensure secure communication with APIs using HTTPS

---

## Git Workflow

The project follows a modified GitFlow workflow:

- `main`: Production-ready code (source of truth, rarely committed to directly)
- `develop`: **Primary development branch** — all PRs should target this branch
- Feature branches: `feature/feature-name`
- Hotfix branches: `hotfix/issue-description`
- Release branches: `release/version-number`

**IMPORTANT:** Always use `develop` as the base branch for PRs and feature work. Never target `main` directly unless doing a release merge.

### After Version Bump

```bash
git commit -am "Bump version to X.Y.Z"
git push
git push origin vX.Y.Z
```

---

## Deployment Process

For detailed deployment information, refer to `docs/deployment/deployment.md`.

### Quick Summary

1. Bump version using appropriate command
2. Commit changes and push with version tag
3. **Android:**
   ```bash
   expo prebuild --platform android --clean
   cd android && ./gradlew bundleRelease
   ```
   AAB location: `android/app/build/outputs/bundle/release/app-release.aab`

4. **iOS:**
   ```bash
   expo prebuild --platform ios --clean
   cd ios && open Bayaan.xcworkspace
   ```
   In Xcode: Clean Build Folder → Build → Archive

### Keystore & Credentials

- Keystore: `~/Documents/app-credentials/bayaan/keystore/bayaan-upload-key.keystore`
- Credentials: `~/.gradle/gradle.properties` (BAYAAN_UPLOAD_* variables)
- iOS Team ID: `S4W5Q2L53W` (auto-configured via `withIOSTeam.js` plugin)

---

## Adding/Updating Reciters in Supabase

This section documents the complete process for adding new reciters or updating existing ones.

### Supabase Configuration

**Project Details:**
- Project ID: `tncrklrswaounqmirayh`
- Project URL: `https://tncrklrswaounqmirayh.supabase.co`
- Environment variables: `~/Documents/Bayaan/.env`

**Required Keys:**
- `SUPABASE_URL` - Project URL
- `SUPABASE_ANON_KEY` - For read operations
- `SUPABASE_SERVICE_ROLE_KEY` - Required for storage uploads (bypasses RLS)

### Database Schema

#### `reciters` Table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Reciter's display name |
| date | text | Birth/death dates or era |
| image_url | text | URL to reciter's image |

#### `rewayat` Table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| reciter_id | uuid | Foreign key to reciters |
| name | text | Rewayah name (e.g., "Hafs A'n Asim") |
| style | text | Recitation style |
| server | text | Base URL for audio files |
| surah_total | integer | Total number of available surahs |
| surah_list | text | Comma-separated list of surah numbers |
| source_type | text | Source identifier ("supabase", "mp3quran") |

### Storage Bucket Structure

```
quran-audio/
└── reciters/
    └── {reciter-folder-name}/
        ├── 001.mp3    # Al-Fatiha
        ├── 002.mp3    # Al-Baqarah
        └── 114.mp3    # An-Nas
```

**File Naming Convention:**
- 3-digit zero-padded surah numbers: `001.mp3`, `002.mp3`, ..., `114.mp3`
- Folder names: lowercase with hyphens (e.g., `mohammed-jibreel`)

### Step-by-Step Process

#### 1. Download Recitations

**From SoundCloud:**
```bash
cd /Users/osmansaeday/Documents/Recitations/{reciter-name}
yt-dlp -x --audio-format mp3 --audio-quality 0 \
  -o "%(playlist_index)03d.%(ext)s" \
  --download-archive downloaded.txt \
  "SOUNDCLOUD_PLAYLIST_URL"
```

**From MP3Quran.net:**
```bash
# API: https://mp3quran.net/api/v3/reciters?language=eng
curl -o 001.mp3 "https://server{X}.mp3quran.net/{reciter}/001.mp3"
```

#### 2. Verify Downloaded Files

```bash
ls -1 *.mp3 | wc -l                    # Count files
ls *.mp3 | sed 's/.mp3//' | sort -n    # Check for gaps
ls -lh *.mp3                           # Check file sizes
```

#### 3. Check if Reciter Exists

```sql
SELECT * FROM reciters WHERE name ILIKE '%reciter name%';
SELECT * FROM rewayat WHERE reciter_id = 'reciter-uuid';
```

#### 4a. Add NEW Reciter

```sql
INSERT INTO reciters (id, name, date, image_url)
VALUES (gen_random_uuid(), 'Reciter Name', 'Era', 'image_url');

INSERT INTO rewayat (id, reciter_id, name, style, server, surah_total, surah_list, source_type)
VALUES (
  gen_random_uuid(),
  'reciter-uuid',
  'Hafs A''n Asim',
  'Murattal',
  'https://tncrklrswaounqmirayh.supabase.co/storage/v1/object/public/quran-audio/reciters/{folder}',
  114,
  '1,2,3,...,114',
  'supabase'
);
```

#### 4b. Update EXISTING Reciter

```sql
UPDATE rewayat SET
  server = 'https://tncrklrswaounqmirayh.supabase.co/storage/v1/object/public/quran-audio/reciters/{folder}',
  surah_total = 114,
  surah_list = '1,2,3,...,114',
  source_type = 'supabase'
WHERE id = 'rewayat-uuid';
```

#### 5. Upload to Supabase Storage

**Important:** Use SERVICE_ROLE_KEY (anon key fails due to RLS).

```bash
cd /Users/osmansaeday/Documents/Recitations/{reciter-name}

for file in *.mp3; do
  curl -X POST "https://tncrklrswaounqmirayh.supabase.co/storage/v1/object/quran-audio/reciters/{folder}/$file" \
    -H "Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: audio/mpeg" \
    --data-binary "@$file"
done
```

**For large files (>100MB):**
```bash
ffprobe {file}.mp3 2>&1 | grep -E "bitrate|Duration"
ffmpeg -i {file}.mp3 -b:a 128k -y {file}_compressed.mp3
mv {file}_compressed.mp3 {file}.mp3
```

#### 6. Verify Upload

```bash
curl -s "https://tncrklrswaounqmirayh.supabase.co/storage/v1/object/list/quran-audio" \
  -H "Authorization: Bearer {SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"prefix":"reciters/{folder}/","limit":120}' | jq 'length'
```

#### 7. Update Frontend Data

```bash
cd /Users/osmansaeday/Bayaan/Bayaan
npm run fetch-reciters
```

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| "Payload too large" | Compress to <100MB using ffmpeg at 128kbps |
| "RLS policy violation" | Use SERVICE_ROLE_KEY instead of ANON_KEY |
| Missing @supabase/supabase-js | Run `npm install @supabase/supabase-js` |
| Incomplete SoundCloud downloads | Use `--download-archive downloaded.txt` to resume |
| Files not playing | Verify 3-digit naming, check server URL has no trailing slash |

### Audio Sources Reference

| Source | URL Pattern |
|--------|-------------|
| MP3Quran.net | `https://server{X}.mp3quran.net/{reciter}/{surah}.mp3` |
| Archive.org | `https://archive.org/download/{collection}/{file}` |
| SoundCloud | Use yt-dlp with playlist URL |
| Supabase | `https://tncrklrswaounqmirayh.supabase.co/storage/v1/object/public/quran-audio/reciters/{folder}/{surah}.mp3` |

### Local Recitations Directory

```
/Users/osmansaeday/Documents/Recitations/
├── ahmed-bin-taleb/     # 109 surahs
├── mohammed-jibreel/    # 114 surahs (complete)
└── {other-reciters}/
```

---

## Documentation Reference

Additional documentation is available in the `docs/` directory:

- **[App Initialization](docs/development/app-initialization.md)** - App startup process and service registration
- **[Downloads Feature](docs/features/downloads.md)** - Offline download functionality
- **[Player System](docs/features/player.md)** - Audio player architecture
- **[Queue Management](docs/features/queue.md)** - Queue system
- **[Deployment Guide](docs/deployment/deployment.md)** - Build and release procedures
- **[Version Management](docs/deployment/version-management.md)** - Git-based versioning
- **[Git Workflow](docs/development/git-workflow.md)** - Branching and collaboration

