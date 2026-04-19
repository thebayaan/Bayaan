# Instagram Story Sharing — Design

**Status:** Draft
**Date:** 2026-04-19
**Scope:** Phase 1 — verse sharing to Instagram Stories (image only, no audio)

## Goal

Let users share a verse to their Instagram Story as a branded, visually polished card with an attribution link back to Bayaan — the same class of integration Spotify has for tracks.

Phase 1 ships verse-only. The architecture must leave room to add mushaf page / reciter / dhikr templates later without a re-plumb. Audio snippet sharing is an explicit non-goal for this phase.

## User flow

1. User taps share on a verse (existing `VerseShareSheet`).
2. The sheet now has an **"Instagram Story"** button alongside the existing "Share…" and watermark/basmallah toggles.
3. Tapping it opens a full-screen **Instagram Story modal**.
4. The modal shows a large preview of the current template, a horizontal row of template thumbnails, a translation toggle, and a primary "Share to Story" CTA (plus a save-to-camera-roll icon).
5. Swiping or tapping thumbnails switches the template; preview updates live.
6. "Share to Story" renders background + sticker PNGs, loads them into the OS pasteboard/intent with Meta's Share-to-Stories keys, and opens Instagram. The user lands directly in IG's story editor with our sticker already placed.
7. If Instagram isn't installed, show a toast and fall back to the native share sheet.

## Templates

Four ship in Phase 1 as a picker. Each is implemented as a `(Background, Sticker)` Skia composition — we render each to its own PNG and send both to Instagram, so users can drag/resize/rotate the sticker in IG.

### 1. Classic Cream
- **Background:** Radial/diagonal gradient — teal to near-black to plum (`#0a1f2c → #050b10 → #1a0a2c`).
- **Sticker:** Light cream card (`#f4f3ec`) with the existing share-card composition: ornamental divider frame with QCF surah name, basmallah (first verse only), Arabic verse, optional translation, Bayaan watermark.
- **Maps to:** Existing `ShareCardPreview` with the light theme.

### 2. Midnight Gold
- **Background:** Deep twilight gradient with warm gold bloom + scattered "stars" (subtle white speckle).
- **Sticker:** Dark card (`#0c1a24 → #050b10` linear gradient) with 1px hairline gold border (`#be9146 @ 25%`). QCF surah name and basmallah in gold; verse in off-white.
- **Maps to:** `ShareCardPreview` dark theme + a new gold accent color override.

### 3. Full-bleed Calligraphy
- **Background:** Subtle radial glow (gold top-left, violet bottom-right) on near-black, with a faint diagonal line texture.
- **Sticker:** The verse itself — centered large Arabic text, small surah label above in letter-spaced uppercase, "made with Bayaan" below. Transparent PNG so users can move the whole verse as one piece.
- **Maps to:** New renderer; the "sticker" is text + brand on transparent background.

### 4. Mushaf Page
- **Background:** Deep brown (`#1a0f08 → #0a0703`) with a warm radial glow at the bottom.
- **Sticker:** Rectangular cream mushaf page (`#f4ead2 → #eadcb0`) with a double-ruled gold border (`#8a6420`), Arabic surah name at top, basmallah if first verse, verse with a circular ayah-number ornament, small Bayaan mark at bottom.
- **Maps to:** New renderer; draws heavy ornate frame around the existing verse paragraph.

## Content rules

- **Surah header:** always shown (varies by template — Latin transliteration for Classic/Midnight, none for Full-bleed's minimal top label, Arabic for Mushaf).
- **Basmallah:** shown only if the first verse in the range is ayah 1 of its surah. Auto-determined — no user toggle in the IG modal (diverges from `VerseShareSheet`'s basmallah toggle; we're opting for zero-decision UX on the IG flow).
- **Arabic text:** rendered via Digital Khatt through Skia Paragraph (same pipeline as the mushaf view). Respects the user's current `rewayah` setting and displays the rewayah disclosure label for non-Hafs.
- **Translation:** off by default; user-toggleable in the modal.
  - Source: Saheeh International (already bundled).
  - Attribution line shown below translation when enabled (`SAHEEH INTERNATIONAL · 94:6`).
  - Fit cascade when translation is on:
    1. Try normal sizes.
    2. Shrink translation font stepwise down to a floor.
    3. Truncate translation with "…" and append a small "Read the full verse in Bayaan" line.
    4. If Arabic alone still doesn't fit at its smallest configured size, show an in-modal error: "This verse is too long to share — try a shorter range." The toggle and share button are disabled in this case.
- **Watermark:** always shown (Bayaan starburst + "made with Bayaan"). Non-optional for IG shares in Phase 1 to preserve attribution on a public social surface.
- **Attribution URL:** the existing `verseShareUrl(surah, ayah)` — e.g. `https://app.thebayaan.com/share/verse/94/6`. Passed via `com.instagram.sharedSticker.contentURL` / `content_url` so Instagram's built-in link sticker takes viewers back into Bayaan via the existing universal-link setup.

## Technical architecture

### Meta App ID
- Stored as `EXPO_PUBLIC_FACEBOOK_APP_ID` in `.env`. Value: `1522072866585359`.
- Not a secret — the App ID is a public anti-abuse identifier.
- No Facebook Login, Graph API, or App Review required for Stories sharing.
- App left in "Development" mode on the Meta dashboard indefinitely.

### Rendering pipeline
Every template defines two Skia compositions:

```
type Template = {
  id: 'classic-cream' | 'midnight-gold' | 'fullbleed-calligraphy' | 'mushaf-page';
  name: string;
  renderBackground(ctx: RenderContext): SkImage;  // 1080×1920 opaque PNG
  renderSticker(ctx: RenderContext): SkImage;      // variable size transparent PNG
};
```

`RenderContext` carries: verse keys, rewayah, translation-enabled flag, fontMgr, typeface, theme.

Each template module lives in `components/share/instagram-story/templates/<id>.ts` and exports a `Template` object. A registry at `components/share/instagram-story/templates/index.ts` lists them in display order.

The modal's preview uses scaled `<Canvas>` elements that reactively re-render on template/translation/verse changes (same pattern as `ShareCardPreview`). On "Share to Story", an off-screen 1080×1920 canvas captures the final background and a separately-sized canvas captures the sticker — both via the existing `captureShareCard` pattern, writing two PNG files to `FileSystem.cacheDirectory`.

### Share helper
A new `utils/instagramStoryShare.ts`:

```ts
export async function shareVerseToInstagramStory(params: {
  backgroundUri: string;
  stickerUri: string;
  attributionUrl: string;
}): Promise<{shared: boolean; reason?: 'not-installed' | 'cancelled' | 'error'}>;
```

Implementation uses `react-native-share`'s `Share.shareSingle({ social: Share.Social.INSTAGRAM_STORIES, ... })`, which already handles the pasteboard keys on iOS and the intent on Android. Wrap with install-check via `Linking.canOpenURL('instagram-stories://')` / `Share.isPackageInstalled('com.instagram.android')`.

On failure/not-installed, return a typed reason; caller shows a toast and falls back to the native share sheet.

### Native config
- iOS: add `instagram-stories` to `LSApplicationQueriesSchemes` in `app.json`'s `ios.infoPlist`.
- Android: add `<package android:name="com.instagram.android" />` in the `<queries>` block of `AndroidManifest.xml` via an Expo config plugin or managed config.
- Requires `expo prebuild` (already in the project's script set).

### Integration points in existing code
- `components/sheets/VerseShareSheet.tsx` — add "Instagram Story" button.
- `components/sheets/instagram-story/InstagramStoryModal.tsx` (new) — the full-screen picker.
- `components/share/instagram-story/` (new directory) — templates, renderers, types.
- `utils/instagramStoryShare.ts` (new) — pasteboard/intent helper.
- `utils/shareUtils.ts` — no changes; existing `verseShareUrl()` is reused.
- `services/analytics/AnalyticsService.ts` — add `trackInstagramStoryShare({template, translation_shown, content_type: 'verse', surah_id, verse_range})`.

### Fallbacks & errors
- Instagram not installed → toast "Instagram isn't installed" + open native share sheet.
- Share cancelled by user → silent (no analytics event beyond "attempt").
- Pasteboard write failure → generic error toast, logged to Sentry.
- Long-verse overflow → modal shows inline error, share button disabled.

## Out of scope (explicitly)

- Audio snippet sharing (Phase 2 — needs MP4 encoder decision).
- Mushaf page, reciter, adhkar, dhikr content types (later phases).
- User-customizable colors or per-template theme overrides beyond the translation toggle.
- Sharing to Facebook Stories, WhatsApp Status, or Snapchat (same API family; additive later).
- Public Instagram Reels / Feed posts (different API surface).
- Animated / video backgrounds.

## Success criteria

- Tapping "Share to Story" on any verse lands the user in Instagram's story editor within 2 seconds on a mid-tier device, with our sticker pre-placed.
- All 4 templates render correctly for verses of varying length (tested: short, medium, Ayat al-Kursi, cross-surah range).
- Long-verse overflow is handled gracefully per the fit cascade — no degraded or truncated layouts escape.
- Tapping the Bayaan sticker from another user's story deep-links into the app on the correct verse.
- Zero crashes in Sentry within first 7 days of release.
