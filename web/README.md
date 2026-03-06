# Bayaan Web Deep Link Handler

This directory contains the web-side components for handling shareable deep links for Bayaan.

## Overview

When users share links like `https://thebayaan.com/reciter/al-husary`, this handler:

1. **Detects the content type** (reciter, surah, playlist, etc.)
2. **Generates rich social media previews** with Open Graph and Twitter Card meta tags
3. **Attempts to open the Bayaan app** if user is on mobile
4. **Fallback to app stores** if the app isn't installed
5. **Shows a web preview** with download links

## Components

### Supabase Edge Function (`/supabase/functions/deep-link-handler/`)

A serverless function that handles all deep link URLs and generates appropriate responses.

**Features:**
- Dynamic Open Graph meta tags
- Mobile app detection and redirect
- App store fallback links
- Beautiful web preview page

## Deployment Options

### Option 1: Supabase Edge Functions (Recommended)

Deploy the function to Supabase:

```bash
supabase functions deploy deep-link-handler
```

Then configure your website to route all deep link paths to this function.

### Option 2: Integrate with Existing Website

If you already have a Next.js/Vercel website at thebayaan.com:

1. Copy the logic from `index.ts` to your existing API routes
2. Create dynamic routes for `/reciter/[id]`, `/surah/[num]`, etc.
3. Use the same Open Graph generation logic

### Option 3: Vercel Functions

Convert the Edge Function to Vercel API routes by adapting the handler code.

## URL Patterns Supported

- `/reciter/{id}` - Reciter profile
- `/reciter/{id}/surah/{num}` - Specific recitation
- `/surah/{num}` - Surah (with optional ?reciter= param)
- `/playlist/{id}` - User playlist
- `/adhkar/{superId}` - Adhkar category
- `/adhkar/{superId}/{dhikrId}` - Specific dhikr

## Configuration

Update the mock data in `index.ts` with your actual reciter and surah information, or connect it to your database.

## Testing

Test locally with Deno:

```bash
cd web/supabase/functions/deep-link-handler
deno task dev
```

Then visit `http://localhost:8000/reciter/al-husary` to see the preview.
