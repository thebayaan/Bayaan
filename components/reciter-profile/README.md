# ReciterProfile Component

## Directory Structure
```
components/reciter-profile/
├── README.md
├── index.tsx              # Barrel file for exports
├── types/                # Local type definitions
│   └── index.ts
├── components/           # Component directories
│   ├── ReciterProfile/   # Main composition component
│   │   └── index.tsx
│   ├── ReciterHeader/    # Reciter image and info
│   │   └── index.tsx
│   ├── StickyHeader/     # Blur + gradient header
│   │   └── index.tsx
│   ├── SearchHeader/     # Search functionality
│   │   └── index.tsx
│   ├── SurahList/        # Surah listing
│   │   └── index.tsx
│   └── ActionButtons/    # Play, shuffle, favorite buttons
│       └── index.tsx
└── styles/              # Shared styles
    └── index.ts
```

## Component Organization
- Each component is self-contained in its own directory
- Component-specific types are defined in the local `types` directory
- Shared styles are maintained in the `styles` directory
- Main composition happens in the `ReciterProfile` component
- Root `index.tsx` serves as a barrel file for clean exports

## Features
- Reciter information display
- Surah list with search functionality
- Multiple rewayat support
- Playback controls
- Favorite/bookmark functionality
- Responsive design with animations
- Dark/light theme support

## Props
```typescript
interface ReciterProfileProps {
  id: string;              // Reciter ID
  showFavorites?: boolean; // Show only favorite surahs
}
```

## Usage
```typescript
import {ReciterProfile} from '@/components/reciter-profile';

function MyScreen() {
  return <ReciterProfile id="reciter_id" />;
}
```

## Performance Considerations
- Memoized components to prevent unnecessary re-renders
- Optimized animations using native driver
- Lazy loading of images
- Efficient list rendering with FlatList

## Development Guidelines
1. Keep components small and focused
2. Use proper TypeScript types from the local types directory
3. Maintain consistent styling
4. Document complex logic
5. Test UI changes thoroughly

## Dependencies
- expo-blur
- react-native-reanimated
- react-native-safe-area-context
- @rneui/themed
- react-native-size-matters 