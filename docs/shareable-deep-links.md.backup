# Shareable Deep Links Implementation

This document outlines the complete implementation of shareable deep links for Bayaan, enabling users to share specific content (reciters, surahs, playlists) via URLs like `https://thebayaan.com/reciter/al-husary`.

## Overview

The implementation consists of:

1. **Mobile App Changes** - Universal Links configuration and deep link handling
2. **Web Backend** - URL handling and rich social media previews
3. **Share Components** - Easy-to-use sharing interface for users

## Features Implemented

### ✅ Universal Links Support
- **iOS**: Associated domains configuration for `thebayaan.com`
- **Android**: Intent filters with autoVerify for App Links
- **Custom URL Scheme**: Maintains backward compatibility with `bayaan://` 

### ✅ Deep Link Routing
- Automatic parsing of incoming URLs to app screens
- Support for complex nested routes (reciter → surah)
- Query parameter preservation for analytics/behavior
- Graceful fallback handling for invalid URLs

### ✅ Share Components
- **ShareButton**: Full-featured sharing with custom messages
- **ShareIcon**: Minimal icon-based sharing
- **Platform-aware**: Uses native iOS/Android sharing mechanisms

### ✅ Web Backend (Supabase Edge Function)
- **Rich Social Previews**: Dynamic Open Graph and Twitter Card meta tags
- **Mobile Detection**: Automatic app opening for mobile users
- **App Store Fallback**: Redirect to appropriate app store if app not installed
- **Beautiful Web Preview**: Responsive landing page with download links

## URL Schema

| Content Type | URL Pattern | Example | App Screen |
|--------------|-------------|---------|------------|
| Reciter Profile | `/reciter/{id}` | `thebayaan.com/reciter/al-husary` | `/(tabs)/(a.home)/reciter/[id]` |
| Specific Recitation | `/reciter/{id}/surah/{num}` | `thebayaan.com/reciter/al-husary/surah/2` | Reciter profile with surah |
| Surah | `/surah/{num}` | `thebayaan.com/surah/112?reciter=al-husary` | Home with surah selected |
| Playlist | `/playlist/{id}` | `thebayaan.com/playlist/abc123` | `/(tabs)/(a.home)/playlist/[id]` |
| Adhkar Category | `/adhkar/{superId}` | `thebayaan.com/adhkar/morning` | `/(tabs)/(a.home)/adhkar/[superId]` |
| Specific Dhikr | `/adhkar/{superId}/{dhikrId}` | `thebayaan.com/adhkar/morning/dhikr1` | Adhkar with specific dhikr |

## Files Added/Modified

### Mobile App

#### New Files
- `utils/deepLink/handler.ts` - URL parsing and navigation logic
- `utils/deepLink/useDeepLink.ts` - React hook for deep link handling
- `utils/deepLink/index.ts` - Export barrel file
- `utils/deepLink/__tests__/handler.test.ts` - Unit tests
- `utils/deepLink/README.md` - Usage documentation
- `components/share/ShareButton.tsx` - Full sharing component
- `components/share/ShareIcon.tsx` - Icon-based sharing component
- `components/share/index.ts` - Export barrel file

#### Modified Files
- `app.config.js` - Added Universal Links and App Links configuration
- `app/_layout.tsx` - Integrated deep link handling hook

### Web Backend

#### New Files
- `web/supabase/functions/deep-link-handler/index.ts` - Supabase Edge Function
- `web/supabase/functions/deep-link-handler/deno.json` - Deno configuration
- `web/README.md` - Web deployment documentation

## Usage Examples

### Sharing Content from the App

```tsx
import { ShareButton, ShareIcon } from '@/components/share';

// Share a reciter profile
<ShareButton 
  type="reciter"
  params={{ id: 'al-husary' }}
  title="Share this Reciter"
/>

// Share a specific recitation
<ShareIcon
  type="reciter"
  params={{ id: 'al-husary', surah: '2' }}
  message="Listen to this beautiful recitation of Al-Baqarah"
/>

// Share a playlist
<ShareButton
  type="playlist"
  params={{ id: 'my-favorites' }}
/>
```

### Programmatic Link Generation

```typescript
import { generateShareableLink } from '@/utils/deepLink';

// Generate links for sharing
const reciterLink = generateShareableLink('reciter', { id: 'al-husary' });
const surahLink = generateShareableLink('surah', { num: '112', reciter: 'al-husary' });
const playlistLink = generateShareableLink('playlist', { id: 'abc123' });
```

## Social Media Preview Examples

When shared on social platforms, links will show rich previews:

**Reciter Link**: `thebayaan.com/reciter/al-husary`
```
🕌 Mahmoud Khalil Al-Husary - Bayaan
One of the most renowned Quran reciters
[Beautiful reciter image]
```

**Specific Recitation**: `thebayaan.com/reciter/al-husary/surah/2`
```
🕌 Al-Baqarah (البقرة) - Mahmoud Khalil Al-Husary
Listen to Al-Baqarah recited by Mahmoud Khalil Al-Husary on Bayaan
[Reciter image]
```

## Deployment

### Mobile App
1. **Build and deploy** the app with Universal Links configuration
2. **Upload Apple App Site Association file** to `thebayaan.com/.well-known/apple-app-site-association`
3. **Configure Android App Links** verification on Google Search Console

### Web Backend

#### Option 1: Supabase Edge Functions (Recommended)
```bash
cd web/supabase/functions/deep-link-handler
supabase functions deploy deep-link-handler
```

Then configure `thebayaan.com` to route deep link paths to the Edge Function.

#### Option 2: Integrate with Existing Website
Copy the logic from the Edge Function to your existing Next.js/Vercel website API routes.

## Testing

### Mobile App Deep Links
1. **iOS Simulator**: `xcrun simctl openurl booted "thebayaan.com/reciter/al-husary"`
2. **Android Emulator**: `adb shell am start -W -a android.intent.action.VIEW -d "https://thebayaan.com/reciter/al-husary" com.bayaan.app`
3. **Physical Device**: Send a link via Messages and tap it

### Web Previews
1. Visit `thebayaan.com/reciter/al-husary` in a browser
2. Share the URL on social media to test Open Graph previews
3. Test on mobile to verify app opening behavior

### Unit Tests
```bash
cd Bayaan
npm test utils/deepLink
```

## Analytics & Tracking

Consider adding analytics to track:
- **Deep link opens** - How often shared links are clicked
- **App installs from shares** - Conversion from shared links to app installs
- **Content popularity** - Which reciters/surahs are shared most
- **Share sources** - Which platforms generate the most engagement

## Future Enhancements

1. **Dynamic Content Loading** - Connect web backend to live database for real-time content
2. **Custom Share Messages** - Context-aware sharing messages based on content
3. **Share Analytics Dashboard** - Track sharing performance and popular content
4. **QR Code Generation** - Generate QR codes for easy offline sharing
5. **Shortened URLs** - Optional URL shortening for cleaner sharing

## Security Considerations

- **URL Validation** - Sanitize all incoming URLs to prevent malicious redirects
- **Rate Limiting** - Implement rate limiting on web endpoints to prevent abuse
- **Content Validation** - Verify that shared content IDs exist before generating previews
- **HTTPS Only** - Ensure all links use HTTPS for security

## Maintenance

- **Update Content Data** - Keep the web backend's content metadata in sync with the app
- **Monitor Error Rates** - Track failed deep link handling and preview generation
- **Update App Store Links** - Ensure app store URLs remain valid
- **Test After Updates** - Verify deep links work after app updates or website changes

---

This implementation provides a comprehensive sharing system that will significantly enhance Bayaan's distribution capabilities through viral user sharing.
