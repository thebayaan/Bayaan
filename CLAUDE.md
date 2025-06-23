# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development

```bash
# Start the development server
npm start
# or
yarn start

# Start specific platform
npm run ios        # Run on iOS simulator (macOS only)
npm run android    # Run on Android emulator
npm run web        # Run on web browser

# Reset project (clear caches)
npm run reset-project
```

### Code Quality

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

# Fetch reciter data
npm run fetch-reciters

# Resize splash images
npm run resize-splash-images
```

## Architecture Overview

Bayaan is a React Native/Expo application for Quran audio playback with the following architecture:

### Core Architecture Components

1. **Expo Router (v4)**: File-based routing system for navigation
   - Route files in `/app` directory (similar to Next.js)
   - Nested routes in subdirectories
   - Layout files (`_layout.tsx`) provide shared UI elements

2. **Zustand State Management**:
   - Global stores in `/store` directory
   - Separate stores for different concerns (auth, player, queue, etc.)
   - Persistent state with AsyncStorage integration

3. **Audio Playback System**:
   - Uses `react-native-track-player` for background audio
   - Custom playback services in `/services/player`
   - Queue management in `/services/queue`

4. **Reciter & Surah Data Management**:
   - Static data in `/data` directory
   - Dynamic loading via service layer
   - Image caching with `react-native-fast-image`

### Key Subsystems

#### Audio Playback System

The audio system consists of two main components:

1. **Player Service** (`/services/player`):
   - Unified state interface for player controls
   - Event system for playback events
   - Background playback service
   - Error handling and recovery

2. **Queue Service** (`/services/queue`):
   - Queue management and operations
   - Batch loading for efficient memory usage
   - State synchronization with player

The `useUnifiedPlayer` hook connects components to this system.

#### Authentication & User Data

User authentication is managed through:
- Auth contexts and hooks
- Persistent state in Zustand stores
- Service layer for API communication

#### UI Theming

The app supports dynamic themes (light/dark/system) through:
- Theme context and hooks
- Dynamic style generation
- Color schemes in `/styles/colorSchemes.ts`

## Git Workflow

The project follows a modified GitFlow workflow:

- `main`: Production-ready code
- `develop`: Integration branch for features
- Feature branches: `feature/feature-name`
- Hotfix branches: `hotfix/issue-description`
- Release branches: `release/version-number`

## Version Management

Bayaan uses a Git-based version management system:

1. Semantic version (MAJOR.MINOR.PATCH) from Git tags
2. Build number from Git commit count
3. Version bump through npm scripts (`version:patch`, etc.)

After bumping the version:
```bash
git commit -am "Bump version to X.Y.Z"
git push
git push origin vX.Y.Z
```

## Code Structure

```
Bayaan/
├── app/               # Expo Router screens and layouts
│   ├── (auth)/        # Authentication screens
│   ├── (tabs)/        # Main tab-based screens
│   ├── services/      # Route-specific services
│   └── _layout.tsx    # Root layout component
├── assets/            # Static assets (images, fonts)
├── components/        # Reusable UI components
├── constants/         # Constant values used across the app
├── contexts/          # React Context providers
├── data/              # Static data files
├── hooks/             # Custom React hooks
├── services/          # Global API services/utilities
│   ├── player/        # Audio player service
│   └── queue/         # Queue management service
├── store/             # Zustand state management stores
├── styles/            # Global styles or themes
├── theme/             # Theme configuration
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
```

## Important Patterns

### Component Structure

Components follow a consistent pattern:
- Props interface at the top
- Hooks/state near the beginning
- Helper functions/handlers in the middle
- Return statement with JSX at the end

### Custom Hooks

Custom hooks handle reusable logic:
- `useUnifiedPlayer`: Interface to the audio playback system
- `useQueue`: Queue management operations
- `useTheme`: Theme context and utilities
- `useReciterNavigation`: Navigation helpers for reciter screens

### State Management

Zustand stores are used for global state:
- Independent slices for different concerns
- Persistent state with AsyncStorage
- Selectors for efficient component updates

## Deployment Process

For detailed deployment information, refer to DEPLOYMENT.md. In summary:

1. Bump version using appropriate command
2. Commit changes and push with version tag
3. For Android:
   - Generate fresh native build with `expo prebuild`
   - Build release bundle with Gradle
4. For iOS:
   - Generate fresh native build with `expo prebuild`
   - Use Xcode to build and archive

## Testing Guidelines

- Unit tests are located in `__tests__` directories
- Jest is used as the testing framework
- Run tests with `yarn test`