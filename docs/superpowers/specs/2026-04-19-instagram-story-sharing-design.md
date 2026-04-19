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
- **Maps to:** Adapts the existing `ShareCardPreview` light-theme composition into a sticker renderer. Not a direct reuse — needs to emit a transparent-background PNG (see Rendering pipeline below).

### 2. Midnight Gold
- **Background:** Deep twilight gradient with warm gold bloom + scattered "stars" (subtle white speckle).
- **Sticker:** Dark card (`#0c1a24 → #050b10` linear gradient) with 1px hairline gold border (`#be9146 @ 25%`). QCF surah name and basmallah in gold; verse in off-white.
- **Maps to:** Adapts `ShareCardPreview` dark-theme composition with a new gold accent color override. Same transparent-sticker path as Classic Cream.

### 3. Full-bleed Calligraphy
- **Background:** Subtle radial glow (gold top-left, violet bottom-right) on near-black, with a faint diagonal line texture.
- **Sticker:** The verse itself — centered large Arabic text, small surah label above in letter-spaced uppercase, "made with Bayaan" below. Transparent PNG so users can move the whole verse as one piece.
- **Maps to:** New renderer. Cannot reuse `ShareCardPreview` (it paints an opaque `<Rect>` background at `ShareCardPreview.tsx:107–113`). Sticker is text + brand only on transparent canvas.

### 4. Mushaf Page
- **Background:** Deep brown (`#1a0f08 → #0a0703`) with a warm radial glow at the bottom.
- **Sticker:** Rectangular cream mushaf page (`#f4ead2 → #eadcb0`) with a double-ruled gold border (`#8a6420`), Arabic surah name at top, basmallah if first verse, verse with a circular ayah-number ornament, small Bayaan mark at bottom.
- **Maps to:** New renderer; draws heavy ornate frame around the existing verse paragraph.
- **Cross-surah fallback:** for ranges spanning two surahs (e.g. `2:286 → 3:1`), the ornate title shows the first surah name and a small `+` tag; the verse block renders both surahs with an internal divider. Not as visually balanced — documented limitation.

## Content rules

- **Surah header:** always shown (varies by template — Latin transliteration for Classic/Midnight, none for Full-bleed's minimal top label, Arabic for Mushaf).
- **Basmallah:** shown only if the first verse in the range is ayah 1 of its surah. Auto-determined — no user toggle in the IG modal (diverges from `VerseShareSheet`'s basmallah toggle; we're opting for zero-decision UX on the IG flow).
- **Arabic text:** rendered via Digital Khatt through Skia Paragraph (same pipeline as the mushaf view). Respects the user's current `rewayah` setting and displays the rewayah disclosure label for non-Hafs.
- **Translation:** off by default; user-toggleable in the modal.
  - Source: Saheeh International (already bundled at `VerseShareSheet.tsx:41–44`). **Known coupling:** Phase 1 is hardcoded to Saheeh. When the downloadable-translations feature lands (see `docs/features/translations-tafaseer-research.md`), the IG modal must switch to the active translation or the coupling becomes a bug. Flagged for the translations feature owner.
  - Attribution line shown below translation when enabled (`SAHEEH INTERNATIONAL · 94:6`).
  - Fit cascade when translation is on. **This is net-new fit logic** — `buildShareCardParagraphs.ts` uses a single fixed font size and lets Skia wrap freely; no shrink/truncate code exists to reuse. Build:
    1. Try normal sizes.
    2. Shrink translation font stepwise (e.g. 22 → 20 → 18 → 16 → floor 14). Each step rebuilds the `Paragraph` and measures `getHeight()` until it fits.
    3. If still overflowing at the floor size, truncate translation with "…" at a word boundary and append a small "Read the full verse in Bayaan" line.
    4. If Arabic alone still doesn't fit at its smallest configured size (same cascade, separate floor), show an in-modal error: "This verse is too long to share — try a shorter range." The toggle and share button are disabled in this case.
- **Watermark:** always shown (Bayaan starburst + "made with Bayaan"). Non-optional for IG shares in Phase 1 to preserve attribution on a public social surface.
- **Attribution URL:** the existing `verseShareUrl(surah, ayah)` — e.g. `https://app.thebayaan.com/share/verse/94/6`. Passed via `react-native-share`'s `linkUrl` + `attributionURL` (which map to `com.instagram.sharedSticker.contentURL` / `content_url`) so Instagram's built-in link sticker takes viewers back into Bayaan.
  - **IG in-app browser caveat:** Instagram opens link stickers in its own in-app WebView, which does **not** trigger universal links on iOS. The landing page at `app.thebayaan.com/share/verse/:surah/:ayah` must detect IG's user-agent and render an "Open in Bayaan" button that invokes the `bayaan://` URL scheme. Standard pattern used by Spotify, TikTok, YouTube. If the link is opened outside IG (shared forward to Messages, tapped from Safari, etc.), universal links fire normally. See `app.config.js:26` and `AndroidManifest.xml:48–53` — associated domains / app-links are already configured for `/share/*`.

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

The modal's preview uses scaled `<Canvas>` elements that reactively re-render on template/translation/verse changes (same pattern as `ShareCardPreview`).

**Capture strategy — the PNG generation is the perf-sensitive path.** On "Share to Story", we capture two images: a 1080×1920 opaque background and a variable-size transparent sticker. Two constraints shape this:

1. **Pre-mounted off-screen canvases.** Mounting Skia canvases at capture time adds 300–600ms of mount + first-paint cost. Instead, the modal keeps two hidden `<Canvas>` instances mounted (one per capture target) via absolute-positioned `opacity: 0` containers at full render size. They stay in sync with preview state so a capture is a single `makeImageSnapshot()` — target budget <500ms end-to-end on a mid-tier Android.
2. **Transparent-sticker support.** The existing `ShareCardPreview` always paints an opaque `<Rect>` background at `ShareCardPreview.tsx:107–113`. The sticker renderer omits that rect and captures against the Canvas's default transparent backing. Skia's `encodeToBase64(PNG)` preserves alpha.

`captureShareCard.ts:15` currently hardcodes a single cache filename (`bayaan-share.png`). The IG flow needs two distinct files, so the helper must be parameterized — accept `filename: string` (or an opaque "kind" enum: `'ig-bg' | 'ig-sticker'`). Small change, explicitly called out because the current code would overwrite otherwise.

**Capture-lock on template switch.** The "Share to Story" action is disabled for ~150ms after any template/translation change to let the hidden capture canvases repaint. Share button shows a brief spinner during this window.

**Font readiness gate.** `mushafPreloadService.fontMgr` and `.quranCommonTypeface` are registered as a non-critical priority-5 preload (`services/AppInitializer.ts:273–280`) — not guaranteed ready when the modal opens. The modal must check `if (!fontMgr) { show loader }` (same pattern as `VerseShareSheet.tsx:156`), blocking share until both are available.

### Share helper
A new `utils/instagramStoryShare.ts`:

```ts
export async function shareVerseToInstagramStory(params: {
  backgroundUri: string;
  stickerUri: string;
  attributionUrl: string;
}): Promise<{shared: boolean; reason?: 'not-installed' | 'cancelled' | 'error'}>;
```

Implementation uses `react-native-share`'s `Share.shareSingle({ social: Share.Social.INSTAGRAM_STORIES, ... })` with `backgroundImage`, `stickerImage`, `linkUrl`, `attributionURL`, and `appId`. The library docs confirm these combine in a single call (see [shareSingle docs](https://react-native-share.github.io/react-native-share/docs/share-single)). Wrap with install-check via `Linking.canOpenURL('instagram-stories://')` / `Share.isPackageInstalled('com.instagram.android')`.

**Android risk — load-bearing unknown.** Multiple open GitHub issues report flakiness with combined bg+sticker on Android (black screens, intent redirects to Gallery — see [#924](https://github.com/react-native-share/react-native-share/issues/924), [#1084](https://github.com/react-native-share/react-native-share/issues/1084), [#1441](https://github.com/react-native-share/react-native-share/issues/1441)). The implementation plan **must** start with a bg+sticker+link spike on a real Android device before building the 4 templates. If the combined path is unreliable on Android, fall back to a single composed `backgroundImage` (sticker baked into the 9:16) on Android only — iOS keeps the separable sticker. Templates are authored so "baked" mode is a simple compositor over the existing two renderers.

**New Architecture compatibility.** This project has `RCTNewArchEnabled: true` (Info.plist:83). Verify `react-native-share` version compatibility with New Arch on Expo 55 during the spike; if broken, either pin to a compatible version or evaluate alternatives (custom native module, `expo-sharing` extension).

On failure/not-installed, return a typed reason; caller shows a toast and falls back to the native share sheet.

### Native config
- **iOS** — add to `LSApplicationQueriesSchemes` in `app.config.js` → `ios.infoPlist`:
  - `instagram-stories` (for the share intent URL)
  - `instagram` (for detecting IG installation if `instagram-stories://` probing isn't sufficient)
- **Android** — in `AndroidManifest.xml` (via Expo config):
  - `<queries><package android:name="com.instagram.android" /></queries>` for install detection.
  - Verify whether `react-native-share` ships its own `FileProvider` / `ContentProvider` for the intent URI. If not, add one with a `<paths>` XML covering `FileSystem.cacheDirectory`, and ensure `Intent.FLAG_GRANT_READ_URI_PERMISSION` is set on the share. This is confirmed/disconfirmed during the Android spike (see Share helper section).
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
- Font pack not loaded → modal shows a blocking loader spinner until `mushafPreloadService.fontMgr` + `quranCommonTypeface` resolve.
- Cache hygiene: IG PNGs are written to `FileSystem.cacheDirectory` with overwriting filenames (`ig-bg.png`, `ig-sticker.png`) so each share reuses the same two slots. OS eventually purges; no manual cleanup scheduled.

### Analytics
- `trackInstagramStoryShare({template, translation_shown, content_type: 'verse', surah_id, verse_range})` — fired on successful handoff to IG.
- `trackInstagramStoryCancelled({template})` — user dismissed IG without posting (detect via `shareSingle` rejection with cancel reason).
- `trackInstagramStoryFailed({template, reason})` — `'not-installed' | 'render-failed' | 'share-error' | 'font-timeout'`.
- `trackInstagramStoryOpened({verse_range})` — modal mount.
- `trackInstagramStoryTemplateSwitched({from, to})` — optional, for picker usage telemetry.

### Save to camera roll
The modal's ⬇ icon saves the composed image (sticker on top of background — not the two-layer IG version; a single baked 9:16 PNG) to the device's photo library.
- Uses `expo-media-library` (already installed). Request "add-only" permission on iOS 14+ (`MediaLibrary.PermissionResponse.accessPrivileges === 'limited'` is fine — no need for full library read).
- Fires `trackInstagramStorySaved({template, translation_shown})`.
- Falls back to a toast if the user denies permission.

### Platform & accessibility
- **Orientation:** iPhone is portrait-locked (`app.config.js:13`); iPad allows all four orientations (Info.plist:104–110). The IG modal renders its preview at a 9:16 aspect regardless; on iPad landscape, the modal centers the preview with max-height constraint and lets thumbnails wrap. The hidden capture canvases always render at 1080×1920 — orientation doesn't affect the output PNG.
- **VoiceOver:** template thumbnails have `accessibilityRole="button"` + `accessibilityLabel` per template name; active template announces `accessibilityState={{selected: true}}`. Share CTA has `accessibilityLabel="Share to Instagram Story"`.
- **Dynamic Type:** modal chrome (title, thumbnail labels, toggles, CTA) scales; preview content does NOT scale (the rendered PNG is fixed — otherwise we'd need to re-render on every text-size change and capture would be inconsistent between preview and export).
- **Haptics:** `lightHaptics()` on template-thumbnail tap; `mediumHaptics()` on share confirmation; `heavyHaptics()` on long-verse rejection (all three exist in `utils/haptics.ts`).

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
- Tapping the Bayaan attribution link outside Instagram's in-app browser (forwarded in Messages, opened in Safari, etc.) deep-links via universal link onto the correct verse. Inside IG's in-app browser, the `/share/verse/*` landing page presents an "Open in Bayaan" button using the `bayaan://` URL scheme.
- Zero crashes in Sentry within first 7 days of release.
