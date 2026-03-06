# Deep Link System

This module handles shareable deep links for Bayaan, allowing users to share specific content (reciters with rewayat, surahs, playlists, etc.) with others.

## Features

- **Universal Links** - Handle `thebayaan.com` URLs on iOS and Android
- **Custom URL Scheme** - Support `bayaan://` protocol
- **Rewayat Support** - Full support for different recitation styles
- **Rich Social Previews** - Generate Open Graph meta tags for sharing
- **Easy Share Components** - Drop-in components for sharing content

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

// Share a reciter
const reciterLink = generateShareableLink('reciter', { id: 'al-husary' });
// Result: "https://thebayaan.com/reciter/al-husary"

// Share a reciter with specific rewayat
const reciterRewayatLink = generateShareableLink('reciter', { 
  id: 'al-husary', 
  rewayatId: 'hafs' 
});
// Result: "https://thebayaan.com/reciter/al-husary/rewayat/hafs"

// Share a specific recitation with rewayat
const recitationLink = generateShareableLink('reciter', { 
  id: 'al-husary', 
  rewayatId: 'hafs',
  surah: '2' 
});
// Result: "https://thebayaan.com/reciter/al-husary/rewayat/hafs/surah/2"

// Share a surah with specific reciter and rewayat
const surahLink = generateShareableLink('surah', { 
  num: '112', 
  reciter: 'al-husary',
  rewayatId: 'hafs'
});
// Result: "https://thebayaan.com/surah/112?reciter=al-husary&rewayat=hafs"

// Share a playlist
const playlistLink = generateShareableLink('playlist', { id: 'abc123' });
// Result: "https://thebayaan.com/playlist/abc123"
```

### Share Components

#### ShareButton Component

```tsx
import { ShareButton } from '@/components/share';

// Share a reciter with specific rewayat
<ShareButton 
  type="reciter"
  params={{ id: 'al-husary', rewayatId: 'hafs' }}
  title="Share Reciter"
/>

// Share a specific recitation
<ShareButton 
  type="reciter"
  params={{ id: 'al-husary', rewayatId: 'hafs', surah: '2' }}
  message="Listen to this beautiful recitation of Al-Baqarah"
/>
```

#### ShareIcon Component

```tsx
import { ShareIcon } from '@/components/share';

// Minimal share icon for reciter with rewayat
<ShareIcon 
  type="reciter"
  params={{ id: 'al-husary', rewayatId: 'hafs' }}
/>

// Custom styling for surah with reciter and rewayat
<ShareIcon 
  type="surah"
  params={{ num: '112', reciter: 'al-husary', rewayatId: 'hafs' }}
  size={30}
  color="#007AFF"
  iconName="ios-share"
  iconType="ionicon"
/>
```

## URL Patterns

### New Rewayat-Aware Patterns
| Pattern | Example | Screen | Description |
|---------|---------|--------|-------------|
| `/reciter/{id}/rewayat/{rewayatId}` | `/reciter/al-husary/rewayat/hafs` | Reciter profile | Specific rewayat |
| `/reciter/{id}/rewayat/{rewayatId}/surah/{num}` | `/reciter/al-husary/rewayat/hafs/surah/2` | Reciter with surah | Specific recitation |

### Legacy Patterns (Still Supported)
| Pattern | Example | Screen | Notes |
|---------|---------|--------|-------|
| `/reciter/{id}` | `/reciter/al-husary?rewayat=hafs` | Reciter profile | rewayat as query param |
| `/reciter/{id}/surah/{num}` | `/reciter/al-husary/surah/2?rewayat=hafs` | Reciter with surah | rewayat as query param |
| `/surah/{num}` | `/surah/112?reciter=al-husary&rewayat=hafs` | Home with surah | Both as query params |

### Other Content Types
| Pattern | Example | Screen |
|---------|---------|--------|
| `/playlist/{id}` | `/playlist/abc123` | Playlist view |
| `/adhkar/{superId}` | `/adhkar/morning` | Adhkar category |
| `/adhkar/{superId}/{dhikrId}` | `/adhkar/morning/dhikr1` | Specific dhikr |

## Rewayat Integration

Bayaan organizes recitations by **rewayat** (different recitation styles by the same reciter). Each reciter can have multiple rewayat like:

- **Hafs A'n Assem** (most common)
- **Warsh A'n Nafi** 
- **Qalun A'n Nafi**
- etc.

### URL Structure Decision

We support both patterns for flexibility:

1. **New Pattern** (Preferred): `/reciter/{id}/rewayat/{rewayatId}/surah/{num}`
   - Explicit, hierarchical structure
   - Better for SEO and readability
   - Clear rewayat context

2. **Legacy Pattern**: `/reciter/{id}/surah/{num}?rewayat={rewayatId}`
   - Backward compatible
   - Shorter URLs
   - Query params for metadata

## Web Integration

For the web-side handling (social previews, app redirects), see `/web/README.md`.

The web handler processes rewayat information to provide:

1. **Rich social previews** including rewayat names in titles
2. **Contextual descriptions** mentioning the specific recitation style
3. **Proper metadata** for different rewayat types

## Testing

Run the tests:

```bash
npm test utils/deepLink
```

Test deep links with rewayat in development:

1. **iOS Simulator**: `xcrun simctl openurl booted "bayaan://reciter/al-husary/rewayat/hafs"`
2. **Android Emulator**: `adb shell am start -W -a android.intent.action.VIEW -d "bayaan://reciter/al-husary/rewayat/hafs" com.bayaan.app`
3. **Physical Device**: Send yourself a link and tap it

## Implementation Notes

- **Rewayat ID mapping** - Ensure rewayat IDs in URLs match those in your database
- **Backward compatibility** - Legacy URLs without rewayat still work
- **Query parameter priority** - URL path rewayat takes precedence over query params
- **Fallback handling** - Invalid rewayat IDs gracefully fall back to default
