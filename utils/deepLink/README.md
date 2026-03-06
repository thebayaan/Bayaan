# Deep Link System

This module handles shareable deep links for Bayaan, allowing users to share specific content (reciters, surahs, playlists, etc.) with others.

## Features

- **Universal Links** - Handle `thebayaan.com` URLs on iOS and Android
- **Custom URL Scheme** - Support `bayaan://` protocol
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

// Share a specific recitation
const recitationLink = generateShareableLink('reciter', { 
  id: 'al-husary', 
  surah: '2' 
});
// Result: "https://thebayaan.com/reciter/al-husary/surah/2"

// Share a surah with specific reciter
const surahLink = generateShareableLink('surah', { 
  num: '112', 
  reciter: 'al-husary' 
});
// Result: "https://thebayaan.com/surah/112?reciter=al-husary"

// Share a playlist
const playlistLink = generateShareableLink('playlist', { id: 'abc123' });
// Result: "https://thebayaan.com/playlist/abc123"
```

### Share Components

#### ShareButton Component

```tsx
import { ShareButton } from '@/components/share';

// Share a reciter
<ShareButton 
  type="reciter"
  params={{ id: 'al-husary' }}
  title="Share Reciter"
/>

// Share with custom message
<ShareButton 
  type="surah"
  params={{ num: '112', reciter: 'al-husary' }}
  message="Listen to this beautiful recitation of Al-Ikhlas"
/>
```

#### ShareIcon Component

```tsx
import { ShareIcon } from '@/components/share';

// Minimal share icon
<ShareIcon 
  type="reciter"
  params={{ id: 'al-husary' }}
/>

// Custom styling
<ShareIcon 
  type="playlist"
  params={{ id: 'my-playlist' }}
  size={30}
  color="#007AFF"
  iconName="ios-share"
  iconType="ionicon"
/>
```

## URL Patterns

| Pattern | Example | Screen |
|---------|---------|--------|
| `/reciter/{id}` | `/reciter/al-husary` | Reciter profile |
| `/reciter/{id}/surah/{num}` | `/reciter/al-husary/surah/2` | Reciter profile with surah |
| `/surah/{num}` | `/surah/112?reciter=al-husary` | Home with surah selected |
| `/playlist/{id}` | `/playlist/abc123` | Playlist view |
| `/adhkar/{superId}` | `/adhkar/morning` | Adhkar category |
| `/adhkar/{superId}/{dhikrId}` | `/adhkar/morning/dhikr1` | Specific dhikr |

## Web Integration

For the web-side handling (social previews, app redirects), see `/web/README.md`.

The web handler should be deployed to handle `thebayaan.com` URLs and provide:

1. **Rich social previews** with Open Graph meta tags
2. **Mobile app detection** and automatic redirect to the app
3. **App store fallback** if the app isn't installed
4. **Web preview** with download links

## Testing

Run the tests:

```bash
npm test utils/deepLink
```

Test deep links in development:

1. **iOS Simulator**: Use `xcrun simctl openurl booted "bayaan://reciter/al-husary"`
2. **Android Emulator**: Use `adb shell am start -W -a android.intent.action.VIEW -d "bayaan://reciter/al-husary" com.bayaan.app`
3. **Physical Device**: Send yourself a link via Messages/WhatsApp and tap it

## Implementation Notes

- **Universal Links require domain verification** - ensure your website serves the Apple App Site Association file
- **Android App Links require autoVerify** - configured in app.config.js
- **Route parsing is case-sensitive** - ensure consistent casing in your content IDs
- **Query parameters are preserved** - useful for analytics or special behaviors
