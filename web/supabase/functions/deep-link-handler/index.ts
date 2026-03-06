import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Types for our content
interface ReciterData {
  id: string;
  name: string;
  description?: string;
  image?: string;
}

interface SurahData {
  number: number;
  name: string;
  arabicName: string;
  englishName: string;
  verses: number;
}

interface ContentMetadata {
  title: string;
  description: string;
  image?: string;
  type: 'reciter' | 'surah' | 'playlist' | 'adhkar';
}

// Mock data - in production, this would come from your database
const mockReciters: Record<string, ReciterData> = {
  'al-husary': {
    id: 'al-husary',
    name: 'Mahmoud Khalil Al-Husary',
    description: 'One of the most renowned Quran reciters',
    image: 'https://example.com/al-husary.jpg'
  },
  // Add more reciters as needed
};

const mockSurahs: Record<number, SurahData> = {
  1: { number: 1, name: 'Al-Fatihah', arabicName: 'الفاتحة', englishName: 'The Opening', verses: 7 },
  2: { number: 2, name: 'Al-Baqarah', arabicName: 'البقرة', englishName: 'The Cow', verses: 286 },
  // Add more surahs as needed
};

function parseUrl(url: string): { path: string; params: URLSearchParams } {
  const urlObj = new URL(url);
  return {
    path: urlObj.pathname,
    params: urlObj.searchParams
  };
}

async function getContentMetadata(path: string, params: URLSearchParams): Promise<ContentMetadata | null> {
  const segments = path.split('/').filter(Boolean);
  
  if (segments.length === 0) {
    return {
      title: 'Bayaan - Your Complete Quran Companion',
      description: 'Listen to beautiful Quran recitations, read the Mushaf, and explore Islamic content. Free forever.',
      type: 'reciter'
    };
  }
  
  switch (segments[0]) {
    case 'reciter': {
      if (segments.length >= 2) {
        const reciterId = segments[1];
        const reciter = mockReciters[reciterId];
        
        if (segments.length >= 4 && segments[2] === 'surah') {
          // /reciter/{id}/surah/{num}
          const surahNum = parseInt(segments[3]);
          const surah = mockSurahs[surahNum];
          
          if (reciter && surah) {
            return {
              title: `${surah.name} (${surah.arabicName}) - ${reciter.name}`,
              description: `Listen to ${surah.name} recited by ${reciter.name} on Bayaan`,
              image: reciter.image,
              type: 'reciter'
            };
          }
        } else if (reciter) {
          // /reciter/{id}
          return {
            title: `${reciter.name} - Bayaan`,
            description: reciter.description || `Listen to beautiful Quran recitations by ${reciter.name}`,
            image: reciter.image,
            type: 'reciter'
          };
        }
      }
      break;
    }
    
    case 'surah': {
      if (segments.length >= 2) {
        const surahNum = parseInt(segments[1]);
        const surah = mockSurahs[surahNum];
        const reciterParam = params.get('reciter');
        
        if (surah) {
          const reciter = reciterParam ? mockReciters[reciterParam] : null;
          const reciterText = reciter ? ` - ${reciter.name}` : '';
          
          return {
            title: `${surah.name} (${surah.arabicName})${reciterText}`,
            description: `${surah.englishName} - ${surah.verses} verses. Listen on Bayaan.`,
            type: 'surah'
          };
        }
      }
      break;
    }
    
    case 'playlist': {
      if (segments.length >= 2) {
        const playlistId = segments[1];
        return {
          title: `Playlist - Bayaan`,
          description: `Listen to this curated playlist on Bayaan`,
          type: 'playlist'
        };
      }
      break;
    }
    
    case 'adhkar': {
      if (segments.length >= 2) {
        const superId = segments[1];
        return {
          title: `Adhkar - Bayaan`,
          description: `Read and listen to beautiful Islamic adhkar on Bayaan`,
          type: 'adhkar'
        };
      }
      break;
    }
  }
  
  return null;
}

function generateOpenGraphHTML(metadata: ContentMetadata, originalUrl: string): string {
  const appStoreUrl = 'https://apps.apple.com/app/bayaan/id6648769980';
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.bayaan.app';
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${metadata.title}</title>
  <meta name="description" content="${metadata.description}">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${metadata.title}">
  <meta property="og:description" content="${metadata.description}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${originalUrl}">
  <meta property="og:site_name" content="Bayaan">
  ${metadata.image ? `<meta property="og:image" content="${metadata.image}">` : ''}
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${metadata.title}">
  <meta name="twitter:description" content="${metadata.description}">
  ${metadata.image ? `<meta name="twitter:image" content="${metadata.image}">` : ''}
  
  <!-- iOS App Store -->
  <meta name="apple-itunes-app" content="app-id=6648769980">
  
  <!-- Android App -->
  <meta name="google-play-app" content="app-id=com.bayaan.app">
  
  <!-- Redirect script -->
  <script>
    // Check if user is on mobile and try to open the app
    function detectMobile() {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    function tryOpenApp() {
      const isMobile = detectMobile();
      if (!isMobile) return;
      
      const appUrl = "${originalUrl.replace('https://thebayaan.com', 'bayaan://')}";
      const fallbackUrl = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "${appStoreUrl}" : "${playStoreUrl}";
      
      // Try to open the app
      window.location.href = appUrl;
      
      // Fallback to app store if app doesn't open
      setTimeout(() => {
        window.location.href = fallbackUrl;
      }, 2000);
    }
    
    // Try to open app after a short delay
    setTimeout(tryOpenApp, 100);
  </script>
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      text-align: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      min-height: 100vh;
    }
    .card {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      margin: 20px 0;
    }
    .logo {
      font-size: 2.5em;
      margin-bottom: 20px;
    }
    .title {
      font-size: 1.8em;
      margin-bottom: 15px;
      font-weight: 600;
    }
    .description {
      font-size: 1.1em;
      margin-bottom: 30px;
      opacity: 0.9;
    }
    .buttons {
      display: flex;
      gap: 15px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .btn {
      padding: 12px 24px;
      border-radius: 25px;
      text-decoration: none;
      font-weight: 500;
      transition: transform 0.2s;
    }
    .btn:hover {
      transform: translateY(-2px);
    }
    .btn-primary {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: 2px solid rgba(255, 255, 255, 0.3);
    }
    .loading {
      margin-top: 20px;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🕌</div>
    <h1 class="title">${metadata.title}</h1>
    <p class="description">${metadata.description}</p>
    
    <div class="buttons">
      <a href="${appStoreUrl}" class="btn btn-primary">Download for iOS</a>
      <a href="${playStoreUrl}" class="btn btn-primary">Download for Android</a>
    </div>
    
    <p class="loading">Opening in Bayaan app...</p>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  const url = new URL(req.url);
  const { path, params } = parseUrl(req.url);
  
  console.log(`[Deep Link Handler] ${req.method} ${path}`);
  
  try {
    // Get content metadata
    const metadata = await getContentMetadata(path, params);
    
    if (!metadata) {
      // Return a 404 with fallback to homepage
      return new Response(generateOpenGraphHTML({
        title: 'Bayaan - Your Complete Quran Companion',
        description: 'Listen to beautiful Quran recitations, read the Mushaf, and explore Islamic content.',
        type: 'reciter'
      }, req.url), {
        status: 404,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    // Return HTML with Open Graph tags and app redirect logic
    return new Response(generateOpenGraphHTML(metadata, req.url), {
      headers: { 'Content-Type': 'text/html' }
    });
    
  } catch (error) {
    console.error('[Deep Link Handler] Error:', error);
    
    return new Response(generateOpenGraphHTML({
      title: 'Bayaan - Your Complete Quran Companion',
      description: 'Listen to beautiful Quran recitations, read the Mushaf, and explore Islamic content.',
      type: 'reciter'
    }, req.url), {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
});
