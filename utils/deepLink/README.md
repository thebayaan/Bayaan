# Deep Link System with Rewayat Slug Support

This module handles shareable deep links for Bayaan, allowing users to share specific content (reciters with rewayat, surahs, playlists, etc.) with others using user-friendly URLs.

## Features

- **Universal Links** - Handle `thebayaan.com` URLs on iOS and Android
- **Custom URL Scheme** - Support `bayaan://` protocol
- **Rewayat Slug System** - User-friendly URLs with readable rewayat names
- **Rich Social Previews** - Generate Open Graph meta tags for sharing
- **Easy Share Components** - Drop-in components for sharing content

## Rewayat Slug System

Instead of using UUIDs in URLs (which are ugly and unshareAble), we use human-readable slugs:

### Slug Generation
- **"Hafs A'n Assem"** → `hafs-an-assem`
- **"Warsh A'n Nafi'"** → `warsh-an-nafi`
- **"Qalun A'n Nafi'"** → `qalun-an-nafi`

### URL Examples
```
✅ User-friendly: thebayaan.com/reciter/al-husary/rewayat/hafs-an-assem
❌ Ugly UUID:     thebayaan.com/reciter/al-husary/rewayat/32c6eae7-0c0a-419e-8b44-4e165e262029
```

## Usage

### Handle Incoming Links

Deep links are automatically handled when the app starts or receives a URL:

```typescript
// Already integrated in app/_layout.tsx
import { useDeepLink } from '@/utils/deepLink';

function MyApp() {
  useDeepLink(); // Automatically handles all incoming links
  // ...
}
```

### Generate Shareable Links

```typescript
import { generateShareableLink } from '@/utils/deepLink';

// Share a reciter with specific rewayat (uses slug)
const reciterLink = generateShareableLink('reciter', { 
  id: 'al-husary', 
  rewayatSlug: 'hafs-an-assem' 
});
// Result: "https://thebayaan.com/reciter/al-husary/rewayat/hafs-an-assem"

// Share a specific recitation with rewayat
const recitationLink = generateShareableLink('reciter', { 
  id: 'al-husary', 
  rewayatSlug: 'hafs-an-assem',
  surah: '2' 
});
// Result: "https://thebayaan.com/reciter/al-husary/rewayat/hafs-an-assem/surah/2"

// Share a surah with specific reciter and rewayat
const surahLink = generateShareableLink('surah', { 
  num: '112', 
  reciter: 'al-husary',
  rewayatSlug: 'hafs-an-assem'
});
// Result: "https://thebayaan.com/surah/112?reciter=al-husary&rewayat=hafs-an-assem"
```

### Working with Rewayat Slugs

```typescript
import { generateRewayatSlug, findRewayatBySlug } from '@/utils/deepLink/rewayatSlugs';
import { Rewayat } from '@/data/reciterData';

// Convert a rewayat object to slug for sharing
function createShareLink(reciterId: string, rewayat: Rewayat, surahNum?: number) {
  const rewayatSlug = generateRewayatSlug(rewayat);
  
  return generateShareableLink('reciter', {
    id: reciterId,
    rewayatSlug,
    surah: surahNum?.toString(),
  });
}

// Find rewayat from incoming slug
function handleIncomingLink(reciterRewayat: Rewayat[], slug: string) {
  const foundRewayat = findRewayatBySlug(reciterRewayat, slug);
  if (foundRewayat) {
    // Use the rewayat UUID internally
    selectRewayat(foundRewayat.id);
  }
}
```

### Share Components

#### ShareButton Component

```tsx
import { ShareButton } from '@/components/share';
import { generateRewayatSlug } from '@/utils/deepLink/rewayatSlugs';

// Share a reciter with specific rewayat (auto-converts to slug)
<ShareButton 
  type="reciter"
  params={{ 
    id: 'al-husary', 
    rewayatSlug: generateRewayatSlug(selectedRewayat)
  }}
  title="Share this Recitation Style"
/>

// Share with custom message
<ShareButton 
  type="reciter"
  params={{ 
    id: 'al-husary', 
    rewayatSlug: 'hafs-an-assem', 
    surah: '2' 
  }}
  message="Listen to this beautiful recitation of Al-Baqarah in Hafs style"
/>
```

#### ShareIcon Component

```tsx
import { ShareIcon } from '@/components/share';

// Minimal share icon for reciter with rewayat
<ShareIcon 
  type="reciter"
  params={{ id: 'al-husary', rewayatSlug: 'hafs-an-assem' }}
/>
```

## URL Patterns

### Primary Rewayat-Aware Patterns
| Pattern | Example | Screen | Description |
|---------|---------|--------|-------------|
| `/reciter/{id}/rewayat/{slug}` | `/reciter/al-husary/rewayat/hafs-an-assem` | Reciter profile | Specific rewayat |
| `/reciter/{id}/rewayat/{slug}/surah/{num}` | `/reciter/al-husary/rewayat/hafs-an-assem/surah/2` | Reciter with surah | Specific recitation |

### Legacy Patterns (Still Supported)
| Pattern | Example | Screen | Notes |
|---------|---------|--------|-------|
| `/reciter/{id}` | `/reciter/al-husary?rewayat=hafs-an-assem` | Reciter profile | rewayat as query param |
| `/reciter/{id}/surah/{num}` | `/reciter/al-husary/surah/2?rewayat=hafs-an-assem` | Reciter with surah | rewayat as query param |
| `/surah/{num}` | `/surah/112?reciter=al-husary&rewayat=hafs-an-assem` | Home with surah | Both as query params |

### Other Content Types
| Pattern | Example | Screen |
|---------|---------|--------|
| `/playlist/{id}` | `/playlist/abc123` | Playlist view |
| `/adhkar/{superId}` | `/adhkar/morning` | Adhkar category |
| `/adhkar/{superId}/{dhikrId}` | `/adhkar/morning/dhikr1` | Specific dhikr |

## Component Integration

### ReciterProfile Component

The `ReciterProfile` component now accepts deep link parameters:

```typescript
interface ReciterProfileProps {
  id: string;
  showLoved?: boolean;
  initialRewayatSlug?: string;  // From deep link
  initialSurah?: number;        // From deep link
  autoplay?: boolean;           // From deep link
}
```

**Behavior:**
1. **Rewayat Resolution**: `initialRewayatSlug` is resolved to UUID using `findRewayatBySlug()`
2. **Priority**: Deep link rewayat > saved preference > default (first rewayat)  
3. **Persistence**: Deep link selections are saved as user preferences
4. **Autoplay**: If `autoplay=true` and `initialSurah` is provided, automatically plays the surah

### Route Components

All reciter route components (`[id].tsx`) now accept and pass through deep link parameters:

```typescript
const params = useLocalSearchParams<{
  id: string;
  rewayatSlug?: string;
  surah?: string;  
  autoplay?: string;
}>();

return (
  <ReciterProfile
    id={id}
    initialRewayatSlug={rewayatSlug}
    initialSurah={surah ? parseInt(surah, 10) : undefined}
    autoplay={autoplay === 'true'}
  />
);
```

## Slug Resolution Algorithm

The system uses a robust slug resolution algorithm:

1. **Exact Match**: Try to find rewayat with exactly matching slug
2. **Partial Match**: Try common shortened forms (`hafs`, `warsh`, `qalun`)
3. **UUID Fallback**: Try direct UUID lookup (backward compatibility)
4. **Null Result**: Return `null` if nothing matches

This ensures maximum compatibility while maintaining clean URLs.

## Web Integration

The web backend (`/web/supabase/functions/deep-link-handler/`) handles slug-based URLs and provides:

1. **Rich social previews** with rewayat names in titles
2. **Contextual descriptions** mentioning specific recitation styles  
3. **App redirect logic** using the slug-based URLs
4. **Fallback handling** for invalid slugs

## Testing

Run the comprehensive test suite:

```bash
npm test utils/deepLink
```

Tests cover:
- **URL parsing** with various slug formats
- **Link generation** with different parameter combinations
- **Slug utilities** (conversion, resolution, fallbacks)
- **Edge cases** (invalid slugs, empty arrays, case sensitivity)

### Manual Testing

Test deep links with slugs in development:

1. **iOS Simulator**: 
   ```bash
   xcrun simctl openurl booted "thebayaan.com/reciter/al-husary/rewayat/hafs-an-assem"
   ```

2. **Android Emulator**:
   ```bash
   adb shell am start -W -a android.intent.action.VIEW \
     -d "https://thebayaan.com/reciter/al-husary/rewayat/hafs-an-assem" \
     com.bayaan.app
   ```

3. **Physical Device**: Send yourself a slug-based link and tap it

## Implementation Notes

- **Clean URLs**: Slugs make URLs shareable and SEO-friendly
- **Internal UUIDs**: The app still uses UUIDs internally for data consistency
- **Backward Compatibility**: UUID-based URLs still work as fallback
- **Case Insensitive**: Slug matching is case-insensitive for user convenience
- **Robust Parsing**: Multiple fallback strategies ensure links always work
- **Performance**: Slug resolution is fast with simple string operations

## Common Slug Examples

| Rewayat Name | Generated Slug | URL Example |
|--------------|----------------|-------------|
| Hafs A'n Assem | `hafs-an-assem` | `/reciter/al-husary/rewayat/hafs-an-assem` |
| Warsh A'n Nafi' | `warsh-an-nafi` | `/reciter/al-husary/rewayat/warsh-an-nafi` |
| Qalun A'n Nafi' | `qalun-an-nafi` | `/reciter/al-husary/rewayat/qalun-an-nafi` |
| Duri A'n Al-Kisa'i | `duri-an-al-kisai` | `/reciter/al-husary/rewayat/duri-an-al-kisai` |

Short forms also work: `hafs`, `warsh`, `qalun` all resolve correctly.
