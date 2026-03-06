# Shareable Deep Links Implementation

This document outlines the complete implementation of shareable deep links for Bayaan, enabling users to share specific content (reciters with rewayat, surahs, playlists) via URLs like `https://thebayaan.com/reciter/al-husary/rewayat/hafs`.

## Overview

The implementation consists of:

1. **Mobile App Changes** - Universal Links configuration and deep link handling
2. **Web Backend** - URL handling and rich social media previews with rewayat support
3. **Share Components** - Easy-to-use sharing interface for users

## Features Implemented

### ✅ Universal Links Support
- **iOS**: Associated domains configuration for `thebayaan.com`
- **Android**: Intent filters with autoVerify for App Links
- **Custom URL Scheme**: Maintains backward compatibility with `bayaan://` 

### ✅ Deep Link Routing with Rewayat
- Automatic parsing of incoming URLs to app screens
- **Full rewayat support** for different recitation styles
- Support for complex nested routes (reciter → rewayat → surah)
- Query parameter preservation for analytics/behavior
- **Backward compatibility** with legacy URLs
- Graceful fallback handling for invalid URLs

### ✅ Share Components
- **ShareButton**: Full-featured sharing with custom messages
- **ShareIcon**: Minimal icon-based sharing
- **Platform-aware**: Uses native iOS/Android sharing mechanisms
- **Rewayat-aware**: Includes rewayat information in shared links

### ✅ Web Backend (Supabase Edge Function)
- **Rich Social Previews**: Dynamic Open Graph and Twitter Card meta tags with rewayat info
- **Mobile Detection**: Automatic app opening for mobile users
- **App Store Fallback**: Redirect to appropriate app store if app not installed
- **Beautiful Web Preview**: Responsive landing page with download links
- **Rewayat Metadata**: Contextual titles and descriptions including recitation style

## URL Schema

### Primary Rewayat-Aware URLs
| Content Type | URL Pattern | Example | App Screen |
|--------------|-------------|---------|------------|
| Reciter with Rewayat | `/reciter/{id}/rewayat/{rewayatId}` | `thebayaan.com/reciter/al-husary/rewayat/hafs` | `/(tabs)/(a.home)/reciter/[id]` |
| Specific Recitation | `/reciter/{id}/rewayat/{rewayatId}/surah/{num}` | `thebayaan.com/reciter/al-husary/rewayat/hafs/surah/2` | Reciter with surah |

### Legacy Support (Backward Compatible)
| Content Type | URL Pattern | Example | App Screen |
|--------------|-------------|---------|------------|
| Reciter Profile | `/reciter/{id}` | `thebayaan.com/reciter/al-husary?rewayat=hafs` | `/(tabs)/(a.home)/reciter/[id]` |
| Legacy Recitation | `/reciter/{id}/surah/{num}` | `thebayaan.com/reciter/al-husary/surah/2?rewayat=hafs` | Reciter with surah |

### Other Content Types
| Content Type | URL Pattern | Example | App Screen |
|--------------|-------------|---------|------------|
| Surah | `/surah/{num}` | `thebayaan.com/surah/112?reciter=al-husary&rewayat=hafs` | Home with surah |
| Playlist | `/playlist/{id}` | `thebayaan.com/playlist/abc123` | `/(tabs)/(a.home)/playlist/[id]` |
| Adhkar Category | `/adhkar/{superId}` | `thebayaan.com/adhkar/morning` | `/(tabs)/(a.home)/adhkar/[superId]` |
| Specific Dhikr | `/adhkar/{superId}/{dhikrId}` | `thebayaan.com/adhkar/morning/dhikr1` | Adhkar with dhikr |

## Files Added/Modified

### Mobile App

#### New Files
- `utils/deepLink/handler.ts` - URL parsing with rewayat support
- `utils/deepLink/useDeepLink.ts` - React hook for deep link handling
- `utils/deepLink/types.ts` - TypeScript types including rewayat
- `utils/deepLink/index.ts` - Export barrel file
- `utils/deepLink/__tests__/handler.test.ts` - Unit tests with rewayat scenarios
- `utils/deepLink/README.md` - Usage documentation
- `components/share/ShareButton.tsx` - Full sharing component with rewayat
- `components/share/ShareIcon.tsx` - Icon-based sharing component
- `components/share/index.ts` - Export barrel file

#### Modified Files
- `app.config.js` - Added Universal Links and App Links configuration
- `app/_layout.tsx` - Integrated deep link handling hook

### Web Backend

#### New Files
- `web/supabase/functions/deep-link-handler/index.ts` - Supabase Edge Function with rewayat support
- `web/supabase/functions/deep-link-handler/deno.json` - Deno configuration
- `web/README.md` - Web deployment documentation

## Usage Examples

### Sharing Content from the App

```tsx
import { ShareButton, ShareIcon } from '@/components/share';

// Share a reciter with specific rewayat
<ShareButton 
  type="reciter"
  params={{ id: 'al-husary', rewayatId: 'hafs' }}
  title="Share this Recitation Style"
/>

// Share a specific recitation with rewayat
<ShareIcon
  type="reciter"
  params={{ id: 'al-husary', rewayatId: 'hafs', surah: '2' }}
  message="Listen to Al-Baqarah in Hafs A'n Assem style"
/>

// Share a surah with reciter and rewayat
<ShareButton
  type="surah"
  params={{ num: '112', reciter: 'al-husary', rewayatId: 'hafs' }}
/>
```

### Programmatic Link Generation

```typescript
import { generateShareableLink } from '@/utils/deepLink';

// Generate links with rewayat
const reciterRewayatLink = generateShareableLink('reciter', { 
  id: 'al-husary', 
  rewayatId: 'hafs' 
});

const recitationLink = generateShareableLink('reciter', { 
  id: 'al-husary', 
  rewayatId: 'hafs',
  surah: '2'
});

const surahLink = generateShareableLink('surah', { 
  num: '112', 
  reciter: 'al-husary',
  rewayatId: 'hafs'
});
```

## Social Media Preview Examples

When shared on social platforms, links will show rich previews with rewayat context:

**Reciter with Rewayat**: `thebayaan.com/reciter/al-husary/rewayat/hafs`
```
🕌 Mahmoud Khalil Al-Husary - Hafs A'n Assem - Bayaan
Listen to beautiful Quran recitations by Mahmoud Khalil Al-Husary - Hafs A'n Assem
[Reciter image]
```

**Specific Recitation**: `thebayaan.com/reciter/al-husary/rewayat/hafs/surah/2`
```
🕌 Al-Baqarah (البقرة) - Mahmoud Khalil Al-Husary (Hafs A'n Assem)
Listen to Al-Baqarah recited by Mahmoud Khalil Al-Husary (Hafs A'n Assem) on Bayaan
[Reciter image]
```

**Surah with Context**: `thebayaan.com/surah/112?reciter=al-husary&rewayat=hafs`
```
🕌 Al-Ikhlas (الإخلاص) - Mahmoud Khalil Al-Husary (Hafs A'n Assem)
The Sincerity - 4 verses. Listen on Bayaan.
[App icon]
```

## Rewayat Integration

### Understanding Rewayat

In Bayaan, **rewayat** refers to different recitation styles/traditions by the same reciter:

- **Hafs A'n Assem** - Most common style
- **Warsh A'n Nafi** - North African tradition  
- **Qalun A'n Nafi** - Alternative Madinan tradition
- **Duri A'n Al-Kisa'i** - Kufan tradition

### URL Structure Design

We support both explicit and query-parameter approaches:

1. **Explicit Path** (Preferred): `/reciter/al-husary/rewayat/hafs/surah/2`
   - Clear hierarchical structure
   - Better SEO and social sharing
   - Explicit rewayat context
   - More descriptive URLs

2. **Query Parameters** (Legacy): `/reciter/al-husary/surah/2?rewayat=hafs`
   - Shorter URLs
   - Backward compatible
   - Flexible parameter ordering

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

### Mobile App Deep Links with Rewayat
1. **iOS Simulator**: `xcrun simctl openurl booted "thebayaan.com/reciter/al-husary/rewayat/hafs"`
2. **Android Emulator**: `adb shell am start -W -a android.intent.action.VIEW -d "https://thebayaan.com/reciter/al-husary/rewayat/hafs" com.bayaan.app`
3. **Physical Device**: Send a link via Messages and tap it

### Web Previews
1. Visit `thebayaan.com/reciter/al-husary/rewayat/hafs` in a browser
2. Share the URL on social media to test Open Graph previews with rewayat info
3. Test on mobile to verify app opening behavior

### Unit Tests
```bash
cd Bayaan
npm test utils/deepLink
```

## Analytics & Tracking

Consider adding analytics to track:
- **Rewayat popularity** - Which recitation styles are shared most
- **Deep link opens by rewayat** - User preferences across different styles
- **Content discovery** - How users find different rewayat through shares
- **Reciter-rewayat combinations** - Most popular pairings

## Future Enhancements

1. **Dynamic Rewayat Loading** - Connect web backend to live database for real rewayat data
2. **Rewayat-specific Metadata** - Custom descriptions and images per rewayat
3. **Auto-rewayat Detection** - Smart defaults based on user location/preferences
4. **Rewayat Collections** - Shareable collections of the same surah across different rewayat
5. **Compare Rewayat** - Side-by-side rewayat comparison links

---

This implementation provides a comprehensive sharing system with full rewayat support that will significantly enhance Bayaan's distribution capabilities through viral user sharing while preserving the rich Islamic tradition of different recitation styles.
