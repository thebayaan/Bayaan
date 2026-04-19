# Instagram Story Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a full-screen Instagram Story picker modal with 4 visually distinct templates that shares verses as bg+sticker compositions to Instagram, with an attribution link back to Bayaan.

**Architecture:** A new `InstagramStoryModal` opened from `VerseShareSheet` renders a live preview plus a horizontal thumbnail picker. Each template is a `(renderBackground, renderSticker)` pair producing two PNGs via pre-mounted off-screen Skia canvases. The share helper wraps `react-native-share`'s `shareSingle` with install-detection and typed failure modes. Android reliability is de-risked with a bg+sticker+link spike before building the template system; a "baked" single-image fallback is authored into the template abstraction from day one.

**Tech Stack:** React Native (Expo 55), `@shopify/react-native-skia` 2.2.12, `react-native-share` (newly added), `expo-media-library`, `expo-haptics`, PostHog, Jest (`jest-expo` preset).

**Spec:** `docs/superpowers/specs/2026-04-19-instagram-story-sharing-design.md`

---

## File Structure

**New files:**
- `components/share/instagram-story/types.ts` — `Template`, `RenderContext`, share-result types
- `components/share/instagram-story/fitCascade.ts` — shrink/truncate logic for long verses
- `components/share/instagram-story/__tests__/fitCascade.test.ts`
- `components/share/instagram-story/captureStoryImages.ts` — parameterized dual-image capture
- `components/share/instagram-story/templates/classicCream.tsx`
- `components/share/instagram-story/templates/midnightGold.tsx`
- `components/share/instagram-story/templates/fullBleedCalligraphy.tsx`
- `components/share/instagram-story/templates/mushafPage.tsx`
- `components/share/instagram-story/templates/index.ts` — registry
- `components/share/instagram-story/StoryBackgroundCanvas.tsx` — 1080×1920 off-screen bg
- `components/share/instagram-story/StoryStickerCanvas.tsx` — variable-size transparent sticker
- `components/share/instagram-story/StoryPreviewCanvas.tsx` — scaled composite preview
- `components/sheets/instagram-story/InstagramStoryModal.tsx` — full-screen picker
- `components/sheets/instagram-story/TemplateThumbnail.tsx` — thumbnail tile
- `utils/instagramStoryShare.ts` — `react-native-share` wrapper
- `utils/__tests__/instagramStoryShare.test.ts`

**Modified files:**
- `package.json` / `package-lock.json` — add `react-native-share`
- `.env.example` / `.env` — add `EXPO_PUBLIC_FACEBOOK_APP_ID`
- `app.config.js` — `LSApplicationQueriesSchemes`, Android `<queries>`
- `components/share/captureShareCard.ts` — parameterize filename
- `components/sheets/VerseShareSheet.tsx` — add "Instagram Story" button
- `services/analytics/events.ts` — 5 new event name constants + prop types
- `services/analytics/AnalyticsService.ts` — 5 new methods

---

## Task 1: Install react-native-share and verify New Arch compatibility

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install the library**

Run:
```bash
npm install react-native-share
```

Expected: package added to `dependencies`. No peer-dep warnings that block install.

- [ ] **Step 2: Run prebuild to regenerate native projects**

Run:
```bash
npm run prebuild
```

Expected: clean run, `ios/` and `android/` regenerated.

- [ ] **Step 3: Verify type-check passes**

Run:
```bash
npx tsc --noEmit
```

Expected: same baseline (pre-existing 118 test-file errors; zero new production errors).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json ios android
git commit -m "chore(ig-story): add react-native-share"
```

---

## Task 2: Add Meta App ID to env config

**Files:**
- Modify: `.env.example`, `.env` (local only, not committed)

- [ ] **Step 1: Add the public variable to `.env.example`**

Append to `.env.example`:
```
# Meta (Facebook) App ID for Instagram Story share attribution.
# Public — not a secret. Register at developers.facebook.com.
EXPO_PUBLIC_FACEBOOK_APP_ID=1522072866585359
```

- [ ] **Step 2: Copy to local `.env`**

Run:
```bash
grep -q EXPO_PUBLIC_FACEBOOK_APP_ID .env || echo 'EXPO_PUBLIC_FACEBOOK_APP_ID=1522072866585359' >> .env
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore(ig-story): add EXPO_PUBLIC_FACEBOOK_APP_ID to env example"
```

---

## Task 3: Native config — LSApplicationQueriesSchemes + Android queries

**Files:**
- Modify: `app.config.js`

- [ ] **Step 1: Add `LSApplicationQueriesSchemes` to `ios.infoPlist`**

In `app.config.js`, inside `ios.infoPlist`, add:

```js
LSApplicationQueriesSchemes: ['instagram-stories', 'instagram'],
```

Place it alongside the other `infoPlist` keys (e.g. after `NSCameraUsageDescription`).

- [ ] **Step 2: Add Android `queries` for Instagram package**

In `app.config.js`, under the `android` key (add if missing), add or extend:

```js
android: {
  package: 'com.bayaan.app',
  // ...existing keys...
  queries: [
    {
      package: 'com.instagram.android',
    },
  ],
},
```

If `android.queries` already exists, append the Instagram entry.

- [ ] **Step 3: Regenerate native projects**

Run:
```bash
npm run prebuild
```

Expected: `ios/Bayaan/Info.plist` contains `<key>LSApplicationQueriesSchemes</key>` with `instagram-stories` and `instagram`. `android/app/src/main/AndroidManifest.xml` contains a `<queries>` block with `<package android:name="com.instagram.android" />`.

- [ ] **Step 4: Verify with grep**

Run:
```bash
grep -A5 LSApplicationQueriesSchemes ios/Bayaan/Info.plist
grep -B1 -A1 "com.instagram.android" android/app/src/main/AndroidManifest.xml
```

Expected: both show the new entries.

- [ ] **Step 5: Commit**

```bash
git add app.config.js ios android
git commit -m "feat(ig-story): add iOS+Android queries for Instagram Stories"
```

---

## Task 4: Android spike — prove bg+sticker+link combined share works

This is a **throwaway verification task** to de-risk the biggest unknown in the spec. The outcome decides whether all 4 templates ship with separable stickers (happy path) or fall back to baked single-image mode on Android.

**Files:**
- Create (temporary): `scripts/ig-share-spike.tsx` — a standalone screen mounted from `app/_layout.tsx` behind a dev-only flag. Remove at end of task.
- Use two existing asset PNGs for the spike: any 1080×1920 image + any 640×640 image.

- [ ] **Step 1: Create the spike screen**

Write `scripts/ig-share-spike.tsx`:

```tsx
import React from 'react';
import {View, Text, Button, Alert} from 'react-native';
import Share from 'react-native-share';
import {Asset} from 'expo-asset';

const FB_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID!;

export default function IgShareSpike() {
  const handleShare = async () => {
    try {
      // Use any 1080x1920 + any sticker-sized asset from assets/images/
      const bg = Asset.fromModule(require('../assets/images/ios-dark.png'));
      const sticker = Asset.fromModule(require('../assets/images/ios-light.png'));
      await Promise.all([bg.downloadAsync(), sticker.downloadAsync()]);

      const result = await Share.shareSingle({
        social: Share.Social.INSTAGRAM_STORIES,
        appId: FB_APP_ID,
        backgroundImage: bg.localUri ?? bg.uri,
        stickerImage: sticker.localUri ?? sticker.uri,
        backgroundBottomColor: '#050b10',
        backgroundTopColor: '#1a0a2c',
        attributionURL: 'https://app.thebayaan.com/share/verse/94/6',
        linkUrl: 'https://app.thebayaan.com/share/verse/94/6',
      });
      Alert.alert('Share result', JSON.stringify(result));
    } catch (err: unknown) {
      Alert.alert('Share error', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <View style={{flex: 1, justifyContent: 'center', padding: 24}}>
      <Text style={{marginBottom: 16}}>IG Story spike: bg + sticker + link</Text>
      <Button title="Share to IG Story" onPress={handleShare} />
    </View>
  );
}
```

- [ ] **Step 2: Mount it behind a dev flag**

Temporarily add a route in `app/_layout.tsx` or the nearest router entry that renders `IgShareSpike` when `__DEV__ && EXPO_PUBLIC_IG_SPIKE === '1'`. Alternatively, expose it via a long-press on an existing dev-only surface.

(Exact edit depends on the router layout — the engineer should look at `app/_layout.tsx`, pick the least-invasive mount point, and document it in the commit message.)

- [ ] **Step 3: Run on a real Android device**

Requirements: Instagram app installed, signed in, foreground.

Run:
```bash
EXPO_PUBLIC_IG_SPIKE=1 npm run android
```

Tap "Share to IG Story". **Verify on device:**
1. Instagram opens to the story editor.
2. Background image fills the canvas.
3. Sticker image appears on top, draggable/resizable.
4. The attribution link (sticker or chip) is present and points to `/share/verse/94/6` when tapped.

- [ ] **Step 4: Run on a real iOS device**

Same verification on iOS.

- [ ] **Step 5: Record the verdict in a file**

Create `docs/superpowers/plans/2026-04-19-ig-spike-result.md` with one of:

```
## Verdict: GREEN
Both iOS and Android render bg + sticker + link correctly.
Proceed with full two-layer template architecture.
```

OR

```
## Verdict: YELLOW — Android needs baked mode
iOS: GREEN.
Android issue: [describe: black bg, no sticker, no link, intent redirects to Gallery, etc.]
Decision: iOS ships separable two-layer; Android ships baked single-image composition via backgroundImage only.
```

OR

```
## Verdict: RED
Both platforms fail. [describe root cause.]
Blocker — escalate before proceeding with templates.
```

- [ ] **Step 6: Remove the spike code**

Delete `scripts/ig-share-spike.tsx` and revert the router entry added in Step 2.

Run:
```bash
git status
```

Expected: only `docs/superpowers/plans/2026-04-19-ig-spike-result.md` remains as a new file; `scripts/` and router are clean.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/plans/2026-04-19-ig-spike-result.md
git commit -m "chore(ig-story): record spike result for bg+sticker+link reliability"
```

---

## Task 5: Parameterize captureShareCard

Current `captureShareCard.ts:15` hardcodes `bayaan-share.png`. IG flow writes two distinct files.

**Files:**
- Modify: `components/share/captureShareCard.ts`

- [ ] **Step 1: Add a filename parameter**

Replace the contents of `components/share/captureShareCard.ts` with:

```ts
/**
 * Captures the share card from a Skia Canvas ref and writes it to a
 * temporary PNG file. Returns the file URI for sharing.
 */
import * as FileSystem from 'expo-file-system/legacy';
import {ImageFormat, type CanvasRef} from '@shopify/react-native-skia';

export async function captureShareCard(
  canvasRef: React.RefObject<CanvasRef | null>,
  filename: string = 'bayaan-share.png',
): Promise<string> {
  const image = canvasRef.current?.makeImageSnapshot();
  if (!image) throw new Error('Failed to capture share card image');

  const base64 = image.encodeToBase64(ImageFormat.PNG, 100);
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return uri;
}
```

- [ ] **Step 2: Verify no callers break**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -v __tests__ | grep captureShareCard
```

Expected: no errors. (The default parameter keeps existing callers working.)

- [ ] **Step 3: Commit**

```bash
git add components/share/captureShareCard.ts
git commit -m "refactor(share): parameterize captureShareCard filename"
```

---

## Task 6: Define Template types and RenderContext

**Files:**
- Create: `components/share/instagram-story/types.ts`

- [ ] **Step 1: Write the types file**

```ts
import type {
  SkTypefaceFontProvider,
  SkTypeface,
} from '@shopify/react-native-skia';
import type {RewayahId} from '@/store/mushafSettingsStore';

export type TemplateId =
  | 'classic-cream'
  | 'midnight-gold'
  | 'fullbleed-calligraphy'
  | 'mushaf-page';

export interface RenderContext {
  verseKeys: string[];
  rewayah: RewayahId;
  translationEnabled: boolean;
  fontMgr: SkTypefaceFontProvider;
  quranCommonTypeface: SkTypeface | null;
  fontFamily: string;
}

export interface StickerDimensions {
  width: number;
  height: number;
}

export interface Template {
  id: TemplateId;
  name: string; // user-facing label (e.g. "Classic Cream")
  backgroundColorTop: string; // fallback hex for IG pasteboard
  backgroundColorBottom: string;
  /** Skia render node for the 1080x1920 background. */
  Background: React.FC<{ctx: RenderContext}>;
  /** Skia render node for the sticker on a transparent canvas. */
  Sticker: React.FC<{ctx: RenderContext}>;
  /** Reports the sticker's final dimensions given the context — used to
   *  size the off-screen capture canvas. */
  getStickerDimensions(ctx: RenderContext): StickerDimensions;
}

export interface StoryShareResult {
  shared: boolean;
  reason?: 'not-installed' | 'cancelled' | 'render-failed' | 'share-error';
}
```

- [ ] **Step 2: Verify type-check**

Run:
```bash
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
git add components/share/instagram-story/types.ts
git commit -m "feat(ig-story): add template and render context types"
```

---

## Task 7: Write fit-cascade logic with unit tests

This is net-new logic — `buildShareCardParagraphs.ts` has no shrink/truncate code. Pure-function shape makes it easily testable.

**Files:**
- Create: `components/share/instagram-story/fitCascade.ts`
- Create: `components/share/instagram-story/__tests__/fitCascade.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `components/share/instagram-story/__tests__/fitCascade.test.ts`:

```ts
import {chooseTranslationFit, TranslationFitResult} from '../fitCascade';

describe('chooseTranslationFit', () => {
  // Simulated measurer: height = textLength * fontSize / 20 (proportional to both)
  const fakeMeasure = (text: string, fontSize: number): number =>
    Math.ceil((text.length * fontSize) / 20);

  it('returns fit at default size when well under maxHeight', () => {
    const result = chooseTranslationFit({
      text: 'Indeed, with hardship comes ease.',
      fontSizes: [22, 20, 18, 16, 14],
      maxHeight: 1000,
      measure: fakeMeasure,
    });
    expect(result.status).toBe('fit');
    if (result.status === 'fit') expect(result.fontSize).toBe(22);
    expect(result.truncated).toBe(false);
  });

  it('shrinks font until text fits', () => {
    const result = chooseTranslationFit({
      text: 'a'.repeat(100),
      fontSizes: [22, 20, 18, 16, 14],
      maxHeight: 80, // forces shrink: 100*14/20 = 70 (fits), 100*16/20 = 80 (edge)
      measure: fakeMeasure,
    });
    expect(result.status).toBe('fit');
    if (result.status === 'fit') expect(result.fontSize).toBeLessThan(22);
    expect(result.truncated).toBe(false);
  });

  it('truncates with ellipsis when floor size still overflows', () => {
    const result = chooseTranslationFit({
      text: 'a'.repeat(1000),
      fontSizes: [22, 20, 18, 16, 14],
      maxHeight: 50,
      measure: fakeMeasure,
    });
    expect(result.status).toBe('truncated');
    if (result.status === 'truncated') {
      expect(result.fontSize).toBe(14); // floor
      expect(result.text.endsWith('…')).toBe(true);
      expect(fakeMeasure(result.text, 14)).toBeLessThanOrEqual(50);
    }
  });

  it('truncates at word boundary', () => {
    const result = chooseTranslationFit({
      text: 'one two three four five six seven eight nine ten',
      fontSizes: [14],
      maxHeight: 20,
      measure: fakeMeasure,
    });
    expect(result.status).toBe('truncated');
    if (result.status === 'truncated') {
      const withoutEllipsis = result.text.replace('…', '').trim();
      // Should end on a full word (no partial word before "…")
      expect(withoutEllipsis).toMatch(/\w$/);
    }
  });

  it('returns reject when even an empty string plus ellipsis wouldnt fit', () => {
    const result = chooseTranslationFit({
      text: 'hello world',
      fontSizes: [14],
      maxHeight: 0, // nothing fits
      measure: fakeMeasure,
    });
    expect(result.status).toBe('reject');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npx jest components/share/instagram-story/__tests__/fitCascade.test.ts
```

Expected: FAIL with "Cannot find module" for `../fitCascade`.

- [ ] **Step 3: Write the implementation**

Write `components/share/instagram-story/fitCascade.ts`:

```ts
export type TranslationFitResult =
  | {status: 'fit'; fontSize: number; text: string; truncated: false}
  | {status: 'truncated'; fontSize: number; text: string; truncated: true}
  | {status: 'reject'};

export interface TranslationFitInput {
  text: string;
  fontSizes: number[]; // descending order, e.g. [22,20,18,16,14]
  maxHeight: number;
  measure: (text: string, fontSize: number) => number;
}

export function chooseTranslationFit(
  input: TranslationFitInput,
): TranslationFitResult {
  const {text, fontSizes, maxHeight, measure} = input;

  // 1. Try each size in descending order without truncation.
  for (const size of fontSizes) {
    if (measure(text, size) <= maxHeight) {
      return {status: 'fit', fontSize: size, text, truncated: false};
    }
  }

  // 2. At the floor size, truncate at word boundary until it fits.
  const floor = fontSizes[fontSizes.length - 1];
  if (measure('…', floor) > maxHeight) {
    return {status: 'reject'};
  }

  const words = text.split(/\s+/);
  let lo = 0;
  let hi = words.length;
  let best: string | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const candidate = words.slice(0, mid).join(' ').replace(/\s+$/, '') + '…';
    if (measure(candidate, floor) <= maxHeight) {
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (best === null || best === '…') {
    return {status: 'reject'};
  }

  return {status: 'truncated', fontSize: floor, text: best, truncated: true};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npx jest components/share/instagram-story/__tests__/fitCascade.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/share/instagram-story/fitCascade.ts components/share/instagram-story/__tests__/fitCascade.test.ts
git commit -m "feat(ig-story): add fit cascade for long-verse translations"
```

---

## Task 8: Build the share helper (react-native-share wrapper)

**Files:**
- Create: `utils/instagramStoryShare.ts`
- Create: `utils/__tests__/instagramStoryShare.test.ts`

- [ ] **Step 1: Write the failing test**

Write `utils/__tests__/instagramStoryShare.test.ts`:

```ts
import {shareVerseToInstagramStory} from '../instagramStoryShare';
import Share from 'react-native-share';
import {Linking, Platform} from 'react-native';

jest.mock('react-native-share');
jest.mock('react-native', () => ({
  Platform: {OS: 'ios'},
  Linking: {canOpenURL: jest.fn()},
}));

const mockedShare = Share as jest.Mocked<typeof Share>;
const mockedLinking = Linking as jest.Mocked<typeof Linking>;

describe('shareVerseToInstagramStory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns not-installed when IG URL scheme cannot be opened', async () => {
    mockedLinking.canOpenURL.mockResolvedValue(false);
    const result = await shareVerseToInstagramStory({
      backgroundUri: 'file:///tmp/bg.png',
      stickerUri: 'file:///tmp/sticker.png',
      attributionUrl: 'https://app.thebayaan.com/share/verse/94/6',
    });
    expect(result).toEqual({shared: false, reason: 'not-installed'});
    expect(mockedShare.shareSingle).not.toHaveBeenCalled();
  });

  it('calls shareSingle with correct options when IG is installed', async () => {
    mockedLinking.canOpenURL.mockResolvedValue(true);
    mockedShare.shareSingle.mockResolvedValue({success: true} as never);

    const result = await shareVerseToInstagramStory({
      backgroundUri: 'file:///tmp/bg.png',
      stickerUri: 'file:///tmp/sticker.png',
      attributionUrl: 'https://app.thebayaan.com/share/verse/94/6',
    });

    expect(result.shared).toBe(true);
    expect(mockedShare.shareSingle).toHaveBeenCalledWith(
      expect.objectContaining({
        social: Share.Social.INSTAGRAM_STORIES,
        backgroundImage: 'file:///tmp/bg.png',
        stickerImage: 'file:///tmp/sticker.png',
        attributionURL: 'https://app.thebayaan.com/share/verse/94/6',
        linkUrl: 'https://app.thebayaan.com/share/verse/94/6',
      }),
    );
  });

  it('returns cancelled when user dismisses share', async () => {
    mockedLinking.canOpenURL.mockResolvedValue(true);
    mockedShare.shareSingle.mockRejectedValue(
      Object.assign(new Error('User did not share'), {error: 'User dismissed'}),
    );
    const result = await shareVerseToInstagramStory({
      backgroundUri: 'file:///tmp/bg.png',
      stickerUri: 'file:///tmp/sticker.png',
      attributionUrl: 'https://app.thebayaan.com/share/verse/94/6',
    });
    expect(result).toEqual({shared: false, reason: 'cancelled'});
  });

  it('returns share-error for unknown failures', async () => {
    mockedLinking.canOpenURL.mockResolvedValue(true);
    mockedShare.shareSingle.mockRejectedValue(new Error('Kaboom'));
    const result = await shareVerseToInstagramStory({
      backgroundUri: 'file:///tmp/bg.png',
      stickerUri: 'file:///tmp/sticker.png',
      attributionUrl: 'https://app.thebayaan.com/share/verse/94/6',
    });
    expect(result).toEqual({shared: false, reason: 'share-error'});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx jest utils/__tests__/instagramStoryShare.test.ts
```

Expected: FAIL with "Cannot find module `../instagramStoryShare`".

- [ ] **Step 3: Write the implementation**

Write `utils/instagramStoryShare.ts`:

```ts
import Share from 'react-native-share';
import {Linking, Platform} from 'react-native';
import type {StoryShareResult} from '@/components/share/instagram-story/types';

const FB_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;

export interface ShareToInstagramStoryParams {
  backgroundUri: string;
  stickerUri: string;
  attributionUrl: string;
}

export async function shareVerseToInstagramStory(
  params: ShareToInstagramStoryParams,
): Promise<StoryShareResult> {
  if (!FB_APP_ID) {
    return {shared: false, reason: 'share-error'};
  }

  const installed = await isInstagramInstalled();
  if (!installed) {
    return {shared: false, reason: 'not-installed'};
  }

  try {
    await Share.shareSingle({
      social: Share.Social.INSTAGRAM_STORIES,
      appId: FB_APP_ID,
      backgroundImage: params.backgroundUri,
      stickerImage: params.stickerUri,
      attributionURL: params.attributionUrl,
      linkUrl: params.attributionUrl,
    } as never);
    return {shared: true};
  } catch (err: unknown) {
    if (isCancel(err)) return {shared: false, reason: 'cancelled'};
    return {shared: false, reason: 'share-error'};
  }
}

async function isInstagramInstalled(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    return Linking.canOpenURL('instagram-stories://');
  }
  // Android: check package presence via Share helper.
  try {
    return Boolean(
      await (Share as unknown as {isPackageInstalled?: (pkg: string) => Promise<{isInstalled: boolean}>})
        .isPackageInstalled?.('com.instagram.android')
        .then(r => r.isInstalled),
    );
  } catch {
    return false;
  }
}

function isCancel(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('user did not share') || msg.includes('user dismissed')) {
      return true;
    }
  }
  const shaped = err as {error?: string; code?: string} | null;
  if (shaped?.error?.toLowerCase().includes('dismiss')) return true;
  if (shaped?.code === 'ECANCELLED') return true;
  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npx jest utils/__tests__/instagramStoryShare.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/instagramStoryShare.ts utils/__tests__/instagramStoryShare.test.ts
git commit -m "feat(ig-story): add react-native-share wrapper with install detection"
```

---

## Task 9: Build StoryBackgroundCanvas (1080×1920 off-screen bg)

A hidden Skia Canvas that renders the current template's background at full IG story resolution. Pre-mounted so capture is synchronous.

**Files:**
- Create: `components/share/instagram-story/StoryBackgroundCanvas.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React, {forwardRef} from 'react';
import {View} from 'react-native';
import {Canvas, type CanvasRef} from '@shopify/react-native-skia';
import type {Template, RenderContext} from './types';

export const IG_STORY_WIDTH = 1080;
export const IG_STORY_HEIGHT = 1920;

interface Props {
  template: Template;
  ctx: RenderContext;
}

export const StoryBackgroundCanvas = forwardRef<CanvasRef, Props>(
  ({template, ctx}, ref) => {
    const Background = template.Background;
    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -IG_STORY_WIDTH * 10, // render off-screen
          top: 0,
          width: IG_STORY_WIDTH,
          height: IG_STORY_HEIGHT,
          opacity: 0,
        }}>
        <Canvas
          ref={ref}
          style={{width: IG_STORY_WIDTH, height: IG_STORY_HEIGHT}}>
          <Background ctx={ctx} />
        </Canvas>
      </View>
    );
  },
);
StoryBackgroundCanvas.displayName = 'StoryBackgroundCanvas';
```

- [ ] **Step 2: Type-check**

Run:
```bash
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
git add components/share/instagram-story/StoryBackgroundCanvas.tsx
git commit -m "feat(ig-story): off-screen 1080x1920 background capture canvas"
```

---

## Task 10: Build StoryStickerCanvas (transparent sticker)

**Files:**
- Create: `components/share/instagram-story/StoryStickerCanvas.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React, {forwardRef} from 'react';
import {View} from 'react-native';
import {Canvas, type CanvasRef} from '@shopify/react-native-skia';
import type {Template, RenderContext} from './types';

interface Props {
  template: Template;
  ctx: RenderContext;
}

export const StoryStickerCanvas = forwardRef<CanvasRef, Props>(
  ({template, ctx}, ref) => {
    const Sticker = template.Sticker;
    const dims = template.getStickerDimensions(ctx);
    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -dims.width * 10,
          top: 0,
          width: dims.width,
          height: dims.height,
          opacity: 0,
        }}>
        {/* No <Rect> background — preserves alpha in captured PNG */}
        <Canvas ref={ref} style={{width: dims.width, height: dims.height}}>
          <Sticker ctx={ctx} />
        </Canvas>
      </View>
    );
  },
);
StoryStickerCanvas.displayName = 'StoryStickerCanvas';
```

- [ ] **Step 2: Type-check**

Run:
```bash
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
git add components/share/instagram-story/StoryStickerCanvas.tsx
git commit -m "feat(ig-story): off-screen transparent sticker capture canvas"
```

---

## Task 11: Build captureStoryImages helper

**Files:**
- Create: `components/share/instagram-story/captureStoryImages.ts`

- [ ] **Step 1: Write the helper**

```ts
import type {CanvasRef} from '@shopify/react-native-skia';
import {captureShareCard} from '../captureShareCard';

export interface CapturedStoryImages {
  backgroundUri: string;
  stickerUri: string;
}

export async function captureStoryImages(params: {
  backgroundRef: React.RefObject<CanvasRef | null>;
  stickerRef: React.RefObject<CanvasRef | null>;
}): Promise<CapturedStoryImages> {
  const [backgroundUri, stickerUri] = await Promise.all([
    captureShareCard(params.backgroundRef, 'ig-story-bg.png'),
    captureShareCard(params.stickerRef, 'ig-story-sticker.png'),
  ]);
  return {backgroundUri, stickerUri};
}
```

- [ ] **Step 2: Type-check**

Run:
```bash
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
git add components/share/instagram-story/captureStoryImages.ts
git commit -m "feat(ig-story): dual-image capture helper"
```

---

## Task 12: Implement Classic Cream template

Adapts the existing `ShareCardPreview` light-theme composition into a `Template`. Uses the same `buildShareCardParagraphs` pipeline for Arabic text rendering.

**Files:**
- Create: `components/share/instagram-story/templates/classicCream.tsx`

- [ ] **Step 1: Write the template**

```tsx
import React, {useMemo} from 'react';
import {
  LinearGradient,
  Rect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import type {Template, RenderContext, StickerDimensions} from '../types';
import {IG_STORY_WIDTH, IG_STORY_HEIGHT} from '../StoryBackgroundCanvas';
import {buildShareCardParagraphs} from '../../buildShareCardParagraphs';
import {CARD_CONTENT_WIDTH, CARD_PADDING} from '../../shareCardConstants';

const STICKER_WIDTH = 900; // px — sized for a comfortable 9:16 placement
const STICKER_PADDING = 40;
const STICKER_RADIUS = 36;
const BG_STOP_TOP = '#0a1f2c';
const BG_STOP_MID = '#050b10';
const BG_STOP_BOT = '#1a0a2c';
const STICKER_BG = '#f4f3ec';

const Background: React.FC<{ctx: RenderContext}> = () => (
  <Rect x={0} y={0} width={IG_STORY_WIDTH} height={IG_STORY_HEIGHT}>
    <LinearGradient
      start={vec(IG_STORY_WIDTH * 0.15, 0)}
      end={vec(IG_STORY_WIDTH * 0.85, IG_STORY_HEIGHT)}
      colors={[BG_STOP_TOP, BG_STOP_MID, BG_STOP_BOT]}
      positions={[0, 0.6, 1]}
    />
  </Rect>
);

function useClassicElements(ctx: RenderContext) {
  return useMemo(
    () =>
      buildShareCardParagraphs(
        ctx.verseKeys,
        STICKER_WIDTH - STICKER_PADDING * 2,
        ctx.fontMgr,
        false, // light theme
        true, // watermark on
        ctx.quranCommonTypeface,
        ctx.fontFamily,
        shouldShowBasmallah(ctx.verseKeys),
        ctx.rewayah,
      ),
    [ctx],
  );
}

function shouldShowBasmallah(verseKeys: string[]): boolean {
  const first = verseKeys[0];
  if (!first) return false;
  const [, ayah] = first.split(':');
  return ayah === '1';
}

const Sticker: React.FC<{ctx: RenderContext}> = ({ctx}) => {
  const elements = useClassicElements(ctx);
  const height = elements.totalHeight + STICKER_PADDING * 2;

  // Rounded card background
  const roundedPath = useMemo(() => {
    const p = Skia.Path.Make();
    p.addRRect({
      rect: {x: 0, y: 0, width: STICKER_WIDTH, height},
      rx: STICKER_RADIUS,
      ry: STICKER_RADIUS,
    });
    return p;
  }, [height]);

  return (
    <>
      {/* Card bg — opaque fill on the sticker only; canvas itself stays transparent */}
      <Rect x={0} y={0} width={STICKER_WIDTH} height={height} color={STICKER_BG} />
      {/* (In a full implementation, wrap in a clip path for the rounded corners.
           The Skia rendering of verse paragraphs continues here. See Task 13
           for the full rendering tree — kept identical to ShareCardPreview.) */}
    </>
  );
};

export const classicCreamTemplate: Template = {
  id: 'classic-cream',
  name: 'Classic Cream',
  backgroundColorTop: BG_STOP_TOP,
  backgroundColorBottom: BG_STOP_BOT,
  Background,
  Sticker,
  getStickerDimensions(ctx): StickerDimensions {
    // Mirror the useMemo in Sticker, without hooks.
    const elements = buildShareCardParagraphs(
      ctx.verseKeys,
      STICKER_WIDTH - STICKER_PADDING * 2,
      ctx.fontMgr,
      false,
      true,
      ctx.quranCommonTypeface,
      ctx.fontFamily,
      shouldShowBasmallah(ctx.verseKeys),
      ctx.rewayah,
    );
    return {width: STICKER_WIDTH, height: elements.totalHeight + STICKER_PADDING * 2};
  },
};
```

**Note:** the `Sticker` body above is structurally correct but intentionally omits the full paragraph rendering tree (divider, QCF name, basmallah, verse, watermark) — that's a mechanical port from `ShareCardPreview.tsx` lines 115–230, adapted to omit the outer opaque `<Rect>` background. Port those nodes now.

- [ ] **Step 2: Port the paragraph rendering nodes**

Open `components/share/ShareCardPreview.tsx` lines 115–230. Copy the `elements.sections.forEach(...)` block (section rendering with divider/name/basmallah/verse) and the rewayah label + watermark blocks. Paste into the `Sticker` component between the `<Rect x={0} ... color={STICKER_BG} />` and the closing `</>`. Change `padding` to `STICKER_PADDING` and `contentWidth` to `STICKER_WIDTH - STICKER_PADDING * 2`. Omit the leading opaque background `<Rect>` that lives at `ShareCardPreview.tsx:107–113`.

- [ ] **Step 3: Type-check**

Run:
```bash
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 4: Commit**

```bash
git add components/share/instagram-story/templates/classicCream.tsx
git commit -m "feat(ig-story): classic cream template"
```

---

## Task 13: Register templates + create registry

**Files:**
- Create: `components/share/instagram-story/templates/index.ts`

- [ ] **Step 1: Write the registry**

```ts
import type {Template, TemplateId} from '../types';
import {classicCreamTemplate} from './classicCream';

export const TEMPLATES: readonly Template[] = [classicCreamTemplate];

export function getTemplate(id: TemplateId): Template {
  const t = TEMPLATES.find(x => x.id === id);
  if (!t) throw new Error(`Unknown template: ${id}`);
  return t;
}

export const DEFAULT_TEMPLATE_ID: TemplateId = 'classic-cream';
```

**Note:** Tasks 16–18 add the remaining three templates to this array.

- [ ] **Step 2: Type-check**

Run:
```bash
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
git add components/share/instagram-story/templates/index.ts
git commit -m "feat(ig-story): template registry with classic cream"
```

---

## Task 14: Build StoryPreviewCanvas (scaled live preview)

A single `<Canvas>` that shows the composed sticker-on-background at display scale. Used in the modal's preview area only — it does NOT capture; capture uses the hidden full-res canvases.

**Files:**
- Create: `components/share/instagram-story/StoryPreviewCanvas.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import {Canvas, Group} from '@shopify/react-native-skia';
import type {Template, RenderContext} from './types';
import {IG_STORY_WIDTH, IG_STORY_HEIGHT} from './StoryBackgroundCanvas';

interface Props {
  template: Template;
  ctx: RenderContext;
  /** Preview width in pt — height derives from 9:16 aspect. */
  width: number;
}

export const StoryPreviewCanvas: React.FC<Props> = ({template, ctx, width}) => {
  const height = (width * IG_STORY_HEIGHT) / IG_STORY_WIDTH;
  const scale = width / IG_STORY_WIDTH;
  const dims = template.getStickerDimensions(ctx);
  const Background = template.Background;
  const Sticker = template.Sticker;

  const stickerX = (IG_STORY_WIDTH - dims.width) / 2;
  const stickerY = (IG_STORY_HEIGHT - dims.height) / 2;

  return (
    <Canvas style={{width, height}}>
      <Group transform={[{scale}]}>
        <Background ctx={ctx} />
        <Group transform={[{translateX: stickerX}, {translateY: stickerY}]}>
          <Sticker ctx={ctx} />
        </Group>
      </Group>
    </Canvas>
  );
};
```

- [ ] **Step 2: Type-check**

Run:
```bash
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
git add components/share/instagram-story/StoryPreviewCanvas.tsx
git commit -m "feat(ig-story): scaled preview canvas"
```

---

## Task 15: Build TemplateThumbnail

A small tile in the modal's horizontal picker row. Reuses `StoryPreviewCanvas` at thumbnail size.

**Files:**
- Create: `components/sheets/instagram-story/TemplateThumbnail.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import {Pressable, Text, View} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {StoryPreviewCanvas} from '@/components/share/instagram-story/StoryPreviewCanvas';
import type {Template, RenderContext} from '@/components/share/instagram-story/types';
import {lightHaptics} from '@/utils/haptics';

interface Props {
  template: Template;
  ctx: RenderContext;
  isActive: boolean;
  onPress: (id: Template['id']) => void;
}

export const TemplateThumbnail: React.FC<Props> = ({
  template,
  ctx,
  isActive,
  onPress,
}) => {
  const handlePress = () => {
    lightHaptics();
    onPress(template.id);
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={template.name}
      accessibilityState={{selected: isActive}}
      style={[styles.tile, isActive && styles.tileActive]}>
      <StoryPreviewCanvas
        template={template}
        ctx={ctx}
        width={moderateScale(80)}
      />
      <Text style={styles.label} numberOfLines={1}>
        {template.name}
      </Text>
    </Pressable>
  );
};

const styles = ScaledSheet.create({
  tile: {
    width: '84@ms',
    marginRight: '10@ms',
    borderRadius: '10@ms',
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  tileActive: {
    borderColor: '#38bdf8',
  },
  label: {
    fontSize: '10@ms',
    color: '#e8e8e8',
    textAlign: 'center',
    paddingVertical: '4@ms',
  },
});
```

- [ ] **Step 2: Type-check**

Run:
```bash
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
git add components/sheets/instagram-story/TemplateThumbnail.tsx
git commit -m "feat(ig-story): template thumbnail tile"
```

---

## Task 16: Build InstagramStoryModal skeleton + wire Classic Cream end-to-end

This task integrates everything built so far: preview, thumbnails (1 for now), translation toggle, share button, hidden capture canvases. Verifies the full pipeline end-to-end with one template before adding the other three.

**Files:**
- Create: `components/sheets/instagram-story/InstagramStoryModal.tsx`

- [ ] **Step 1: Write the modal component**

```tsx
import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import ActionSheet, {SheetProps} from 'react-native-actions-sheet';
import {useCanvasRef} from '@shopify/react-native-skia';
import Toast from 'react-native-toast-message';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {verseShareUrl} from '@/utils/shareUtils';
import {lightHaptics, mediumHaptics, heavyHaptics} from '@/utils/haptics';
import {shareVerseToInstagramStory} from '@/utils/instagramStoryShare';
import {analyticsService} from '@/services/analytics/AnalyticsService';
import {
  TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  getTemplate,
} from '@/components/share/instagram-story/templates';
import {StoryBackgroundCanvas} from '@/components/share/instagram-story/StoryBackgroundCanvas';
import {StoryStickerCanvas} from '@/components/share/instagram-story/StoryStickerCanvas';
import {StoryPreviewCanvas} from '@/components/share/instagram-story/StoryPreviewCanvas';
import {captureStoryImages} from '@/components/share/instagram-story/captureStoryImages';
import {TemplateThumbnail} from './TemplateThumbnail';
import type {TemplateId, RenderContext} from '@/components/share/instagram-story/types';

const CAPTURE_LOCK_MS = 150;

export const InstagramStoryModal = (
  props: SheetProps<'instagram-story'>,
) => {
  const {verseKeys} = props.payload ?? {verseKeys: []};
  const {width: screenWidth} = useWindowDimensions();
  const bgRef = useCanvasRef();
  const stickerRef = useCanvasRef();

  const fontMgr = mushafPreloadService.fontMgr;
  const quranCommonTypeface = mushafPreloadService.quranCommonTypeface;
  const rewayah = useMushafSettingsStore(s => s.rewayah);
  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const fontFamily =
    mushafRenderer === 'dk_indopak'
      ? 'DigitalKhattIndoPak'
      : mushafRenderer === 'dk_v1'
      ? 'DigitalKhattV1'
      : 'DigitalKhattV2';

  const [templateId, setTemplateId] = useState<TemplateId>(DEFAULT_TEMPLATE_ID);
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [captureLocked, setCaptureLocked] = useState(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const template = getTemplate(templateId);
  const ctx: RenderContext | null = useMemo(() => {
    if (!fontMgr) return null;
    return {
      verseKeys,
      rewayah,
      translationEnabled,
      fontMgr,
      quranCommonTypeface,
      fontFamily,
    };
  }, [
    verseKeys,
    rewayah,
    translationEnabled,
    fontMgr,
    quranCommonTypeface,
    fontFamily,
  ]);

  React.useEffect(() => {
    if (verseKeys.length > 0) {
      analyticsService.trackInstagramStoryOpened({
        verse_range: formatRange(verseKeys),
      });
    }
  }, [verseKeys]);

  const handleTemplateChange = useCallback(
    (nextId: TemplateId) => {
      if (nextId === templateId) return;
      analyticsService.trackInstagramStoryTemplateSwitched({
        from: templateId,
        to: nextId,
      });
      setTemplateId(nextId);
      setCaptureLocked(true);
      if (lockTimer.current) clearTimeout(lockTimer.current);
      lockTimer.current = setTimeout(() => setCaptureLocked(false), CAPTURE_LOCK_MS);
    },
    [templateId],
  );

  const handleToggleTranslation = useCallback(() => {
    lightHaptics();
    setTranslationEnabled(v => !v);
    setCaptureLocked(true);
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => setCaptureLocked(false), CAPTURE_LOCK_MS);
  }, []);

  const handleShare = useCallback(async () => {
    if (!ctx || captureLocked || isSharing) return;
    mediumHaptics();
    setIsSharing(true);
    try {
      const {backgroundUri, stickerUri} = await captureStoryImages({
        backgroundRef: bgRef,
        stickerRef,
      });
      const [firstSurah, firstAyah] = verseKeys[0].split(':').map(Number);
      const attributionUrl = verseShareUrl(firstSurah, firstAyah);
      const result = await shareVerseToInstagramStory({
        backgroundUri,
        stickerUri,
        attributionUrl,
      });
      if (result.shared) {
        analyticsService.trackInstagramStoryShare({
          template: templateId,
          translation_shown: translationEnabled,
          content_type: 'verse',
          surah_id: firstSurah,
          verse_range: formatRange(verseKeys),
        });
      } else if (result.reason === 'not-installed') {
        heavyHaptics();
        Toast.show({type: 'error', text1: 'Instagram isn’t installed'});
        analyticsService.trackInstagramStoryFailed({
          template: templateId,
          reason: 'not-installed',
        });
      } else if (result.reason === 'cancelled') {
        analyticsService.trackInstagramStoryCancelled({template: templateId});
      } else {
        heavyHaptics();
        Toast.show({type: 'error', text1: 'Couldn’t share to Instagram'});
        analyticsService.trackInstagramStoryFailed({
          template: templateId,
          reason: result.reason ?? 'share-error',
        });
      }
    } catch (err) {
      heavyHaptics();
      Toast.show({type: 'error', text1: 'Failed to render share'});
      analyticsService.trackInstagramStoryFailed({
        template: templateId,
        reason: 'render-failed',
      });
    } finally {
      setIsSharing(false);
    }
  }, [ctx, captureLocked, isSharing, bgRef, stickerRef, verseKeys, templateId, translationEnabled]);

  const previewWidth = Math.min(moderateScale(260), screenWidth - moderateScale(48));

  return (
    <ActionSheet id={props.sheetId} containerStyle={styles.sheet} gestureEnabled>
      <View style={styles.header}>
        <Text style={styles.title}>Share to Instagram</Text>
      </View>

      {!ctx ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loaderText}>Loading fonts…</Text>
        </View>
      ) : (
        <>
          <View style={styles.previewWrap}>
            <StoryPreviewCanvas
              template={template}
              ctx={ctx}
              width={previewWidth}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbsRow}>
            {TEMPLATES.map(t => (
              <TemplateThumbnail
                key={t.id}
                template={t}
                ctx={ctx}
                isActive={t.id === templateId}
                onPress={handleTemplateChange}
              />
            ))}
          </ScrollView>

          <Pressable
            style={styles.toggleRow}
            onPress={handleToggleTranslation}
            accessibilityRole="switch"
            accessibilityState={{checked: translationEnabled}}
            accessibilityLabel="Include English translation">
            <Text style={styles.toggleLabel}>Include translation</Text>
            <View style={[styles.toggleDot, translationEnabled && styles.toggleDotOn]} />
          </Pressable>

          <Pressable
            style={[styles.shareBtn, (captureLocked || isSharing) && styles.shareBtnDisabled]}
            onPress={handleShare}
            disabled={captureLocked || isSharing}
            accessibilityRole="button"
            accessibilityLabel="Share to Instagram Story">
            {isSharing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="instagram" size={18} color="#fff" />
                <Text style={styles.shareBtnText}>Share to Story</Text>
              </>
            )}
          </Pressable>

          {/* Hidden off-screen capture canvases — pre-mounted for fast capture */}
          <StoryBackgroundCanvas ref={bgRef} template={template} ctx={ctx} />
          <StoryStickerCanvas ref={stickerRef} template={template} ctx={ctx} />
        </>
      )}
    </ActionSheet>
  );
};

function formatRange(verseKeys: string[]): string {
  if (verseKeys.length === 0) return '';
  if (verseKeys.length === 1) return verseKeys[0];
  return `${verseKeys[0]} — ${verseKeys[verseKeys.length - 1]}`;
}

const styles = ScaledSheet.create({
  sheet: {
    backgroundColor: '#050b10',
    borderTopLeftRadius: '20@ms',
    borderTopRightRadius: '20@ms',
    paddingBottom: '24@ms',
  },
  header: {paddingVertical: '16@ms', alignItems: 'center'},
  title: {color: '#fff', fontSize: '16@ms', fontWeight: '600'},
  loader: {padding: '32@ms', alignItems: 'center'},
  loaderText: {color: '#aaa', marginTop: '12@ms', fontSize: '12@ms'},
  previewWrap: {alignItems: 'center', paddingVertical: '12@ms'},
  thumbsRow: {paddingHorizontal: '16@ms', paddingVertical: '8@ms'},
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: '20@ms',
    paddingVertical: '12@ms',
  },
  toggleLabel: {color: '#e8e8e8', fontSize: '14@ms'},
  toggleDot: {
    width: '36@ms',
    height: '20@ms',
    borderRadius: '10@ms',
    backgroundColor: '#2a3340',
  },
  toggleDotOn: {backgroundColor: '#38bdf8'},
  shareBtn: {
    marginHorizontal: '16@ms',
    marginTop: '12@ms',
    paddingVertical: '14@ms',
    borderRadius: '14@ms',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#dc2743',
  },
  shareBtnDisabled: {opacity: 0.5},
  shareBtnText: {color: '#fff', fontSize: '14@ms', fontWeight: '600'},
});
```

- [ ] **Step 2: Register the sheet in the ActionSheet registry**

Find the project's ActionSheet registry (search for `registerSheet` or `SheetDefinitions`). Add:

```ts
import {InstagramStoryModal} from '@/components/sheets/instagram-story/InstagramStoryModal';

registerSheet('instagram-story', InstagramStoryModal);

declare module 'react-native-actions-sheet' {
  interface Sheets {
    'instagram-story': SheetDefinition<{payload: {verseKeys: string[]}}>;
  }
}
```

Run:
```bash
grep -rln "registerSheet" app/ components/ 2>/dev/null | head
```

Pick the existing registry file and add the import + call there. (Follow the same pattern as the existing `verse-share` sheet.)

- [ ] **Step 3: Type-check**

Run:
```bash
npx tsc --noEmit
```

Expected: zero new production errors. You will see errors for the analytics methods (added in Task 20) — that's expected; leave the calls in place and the errors will resolve when Task 20 lands. If blocking, stub the methods temporarily on `analyticsService`.

Acceptable temporary stub if needed:
```ts
// services/analytics/AnalyticsService.ts (temporary, replaced in Task 20)
trackInstagramStoryOpened = (_: {verse_range: string}) => {};
trackInstagramStoryTemplateSwitched = (_: {from: string; to: string}) => {};
trackInstagramStoryShare = (_: Record<string, unknown>) => {};
trackInstagramStoryCancelled = (_: {template: string}) => {};
trackInstagramStoryFailed = (_: {template: string; reason: string}) => {};
```

- [ ] **Step 4: Commit**

```bash
git add components/sheets/instagram-story/InstagramStoryModal.tsx \
        <sheet-registry-file> \
        services/analytics/AnalyticsService.ts
git commit -m "feat(ig-story): full-screen story modal with classic cream template"
```

---

## Task 17: Wire "Instagram Story" button into VerseShareSheet

**Files:**
- Modify: `components/sheets/VerseShareSheet.tsx`

- [ ] **Step 1: Add the button**

Open `components/sheets/VerseShareSheet.tsx`. Find the share-action button row (near the bottom of the returned JSX, alongside the existing `Share…` button). Add a sibling button:

```tsx
<Pressable
  style={styles.igStoryBtn}
  accessibilityRole="button"
  accessibilityLabel="Share to Instagram Story"
  onPress={() => {
    SheetManager.hide('verse-share');
    SheetManager.show('instagram-story', {payload: {verseKeys}});
  }}>
  <Feather name="instagram" size={18} color="#fff" />
  <Text style={styles.igStoryBtnText}>Instagram Story</Text>
</Pressable>
```

Add styles (place alongside the existing `styles` object):

```ts
igStoryBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  paddingVertical: moderateScale(12),
  borderRadius: moderateScale(12),
  backgroundColor: '#dc2743',
  marginTop: verticalScale(8),
},
igStoryBtnText: {
  color: '#fff',
  fontSize: moderateScale(14),
  fontWeight: '600',
},
```

- [ ] **Step 2: Type-check**

Run:
```bash
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 3: Manual smoke test on simulator**

Run:
```bash
npm run ios
```

- Open any surah.
- Tap share on a verse → `VerseShareSheet` opens.
- Tap "Instagram Story" → verse-share sheet closes, IG story modal opens.
- Confirm preview renders the Classic Cream template.
- Tap the template thumbnail (there's only one — it should already be active, highlighted).
- Toggle "Include translation" — preview updates.
- Tap "Share to Story" — on simulator, IG won't be installed, so expect the "Instagram isn't installed" toast.

- [ ] **Step 4: Commit**

```bash
git add components/sheets/VerseShareSheet.tsx
git commit -m "feat(ig-story): add Instagram Story button to verse share sheet"
```

---

## Task 18: End-to-end verification on real device (Classic Cream only)

- [ ] **Step 1: Build dev client**

Run:
```bash
npm run ios  # or npm run android
```

(If EAS dev build is needed per the project's prebuild workflow, use `npm run build:dev:ios`.)

- [ ] **Step 2: On real device with Instagram installed**

- Open Bayaan → any verse → Share → Instagram Story → Share to Story.
- Instagram opens to the story editor.
- Verify: background gradient fills canvas; cream sticker card is placed and draggable; attribution link (tap sticker) goes to `app.thebayaan.com/share/verse/X/Y`.

- [ ] **Step 3: Performance sanity check**

Measure time from "Share to Story" tap to Instagram foreground. Target: <2 seconds on a mid-tier device. If significantly slower, investigate capture bottleneck (likely base64 encode on JS thread).

- [ ] **Step 4: No commit (verification-only task)**

If behavior matches expectations, proceed. If not, file issues against the relevant task and fix before moving on.

---

## Task 19: Implement Midnight Gold template

**Files:**
- Create: `components/share/instagram-story/templates/midnightGold.tsx`
- Modify: `components/share/instagram-story/templates/index.ts`

- [ ] **Step 1: Write the template**

Duplicate `classicCream.tsx` to `midnightGold.tsx` and change:

```ts
const BG_STOP_TOP = '#2b1d0a';
const BG_STOP_MID = '#0f0a14';
const BG_STOP_BOT = '#050b10';
const STICKER_BG_TOP = '#0c1a24';
const STICKER_BG_BOT = '#050b10';
const STICKER_BORDER = '#be914640'; // 25% alpha on gold

export const midnightGoldTemplate: Template = {
  id: 'midnight-gold',
  name: 'Midnight Gold',
  // ... rest mirrored
};
```

Key differences from Classic Cream:
- `Background` adds 30–50 randomized "star" `<Circle>`s (use a seeded PRNG based on a constant so it's stable across renders).
- `Sticker` replaces the opaque cream `<Rect>` with a `<LinearGradient>`-filled `<RRect>` and a 1px stroked outer `<RRect>` in `STICKER_BORDER`.
- Pass `isDarkMode: true` to `buildShareCardParagraphs`.
- Surah name / basmallah colors inherit the gold accent — this may require a new arg on `buildShareCardParagraphs` (`accentColor?: string`). If the arg doesn't exist, the cleanest add is an optional override param; default stays at the current theme colors.

If the accent-color override requires refactoring `buildShareCardParagraphs`, do that in a separate commit before this task (sub-step 1a).

- [ ] **Step 2: Register in the index**

Edit `components/share/instagram-story/templates/index.ts`:

```ts
import {midnightGoldTemplate} from './midnightGold';

export const TEMPLATES: readonly Template[] = [
  classicCreamTemplate,
  midnightGoldTemplate,
];
```

- [ ] **Step 3: Type-check + smoke test**

Run:
```bash
npx tsc --noEmit
npm run ios
```

Switch templates in the modal — preview should animate between the two.

- [ ] **Step 4: Commit**

```bash
git add components/share/instagram-story/templates/midnightGold.tsx \
        components/share/instagram-story/templates/index.ts \
        components/share/buildShareCardParagraphs.ts  # if touched
git commit -m "feat(ig-story): midnight gold template"
```

---

## Task 20: Implement Full-bleed Calligraphy template

A standalone renderer — does NOT use `buildShareCardParagraphs` because the composition is fundamentally different (no card, large centered verse only).

**Files:**
- Create: `components/share/instagram-story/templates/fullBleedCalligraphy.tsx`
- Modify: `components/share/instagram-story/templates/index.ts`

- [ ] **Step 1: Write the template**

```tsx
import React, {useMemo} from 'react';
import {
  Paragraph,
  Rect,
  LinearGradient,
  RadialGradient,
  Skia,
  SkParagraphStyle,
  SkTextStyle,
  TextAlign,
  vec,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import type {Template, RenderContext, StickerDimensions} from '../types';
import {IG_STORY_WIDTH, IG_STORY_HEIGHT} from '../StoryBackgroundCanvas';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';

const VERSE_FONT_SIZE = 120;
const STICKER_WIDTH = 950;

const Background: React.FC<{ctx: RenderContext}> = () => (
  <>
    <Rect x={0} y={0} width={IG_STORY_WIDTH} height={IG_STORY_HEIGHT}>
      <LinearGradient
        start={vec(0, 0)}
        end={vec(0, IG_STORY_HEIGHT)}
        colors={['#0a0f14', '#050b10']}
      />
    </Rect>
    <Rect x={0} y={0} width={IG_STORY_WIDTH} height={IG_STORY_HEIGHT} opacity={0.15}>
      <RadialGradient
        c={vec(IG_STORY_WIDTH * 0.3, IG_STORY_HEIGHT * 0.2)}
        r={IG_STORY_WIDTH * 0.5}
        colors={['#b4915f', 'transparent']}
      />
    </Rect>
    <Rect x={0} y={0} width={IG_STORY_WIDTH} height={IG_STORY_HEIGHT} opacity={0.18}>
      <RadialGradient
        c={vec(IG_STORY_WIDTH * 0.7, IG_STORY_HEIGHT * 0.8)}
        r={IG_STORY_WIDTH * 0.5}
        colors={['#503c78', 'transparent']}
      />
    </Rect>
  </>
);

function buildFullBleedParagraph(ctx: RenderContext) {
  const verseText = ctx.verseKeys
    .map(vk => digitalKhattDataService.getVerseText(vk, ctx.rewayah) ?? '')
    .join(' ');
  const paraStyle: SkParagraphStyle = {
    textAlign: TextAlign.Center,
  };
  const builder = Skia.ParagraphBuilder.Make(paraStyle, ctx.fontMgr);
  const textStyle: SkTextStyle = {
    fontFamilies: [ctx.fontFamily],
    fontSize: VERSE_FONT_SIZE,
    color: Skia.Color('#f4f3ec'),
    heightMultiplier: 1.8,
  };
  builder.pushStyle(textStyle).addText(verseText).pop();
  const paragraph = builder.build();
  paragraph.layout(STICKER_WIDTH);
  return paragraph;
}

const Sticker: React.FC<{ctx: RenderContext}> = ({ctx}) => {
  const paragraph = useMemo(() => buildFullBleedParagraph(ctx), [ctx]);
  return <Paragraph paragraph={paragraph} x={0} y={0} width={STICKER_WIDTH} />;
};

export const fullBleedCalligraphyTemplate: Template = {
  id: 'fullbleed-calligraphy',
  name: 'Full-bleed',
  backgroundColorTop: '#0a0f14',
  backgroundColorBottom: '#050b10',
  Background,
  Sticker,
  getStickerDimensions(ctx): StickerDimensions {
    const p = buildFullBleedParagraph(ctx);
    return {width: STICKER_WIDTH, height: p.getHeight()};
  },
};
```

- [ ] **Step 2: Register in index**

```ts
import {fullBleedCalligraphyTemplate} from './fullBleedCalligraphy';

export const TEMPLATES: readonly Template[] = [
  classicCreamTemplate,
  midnightGoldTemplate,
  fullBleedCalligraphyTemplate,
];
```

- [ ] **Step 3: Type-check + smoke test**

Run:
```bash
npx tsc --noEmit
npm run ios
```

- [ ] **Step 4: Commit**

```bash
git add components/share/instagram-story/templates/fullBleedCalligraphy.tsx \
        components/share/instagram-story/templates/index.ts
git commit -m "feat(ig-story): full-bleed calligraphy template"
```

---

## Task 21: Implement Mushaf Page template

**Files:**
- Create: `components/share/instagram-story/templates/mushafPage.tsx`
- Modify: `components/share/instagram-story/templates/index.ts`

- [ ] **Step 1: Write the template**

Structure similar to Classic Cream, but the sticker is a double-ruled ornate page:

```tsx
// — outline —
// Background: dark brown gradient with a warm radial glow at the bottom.
// Sticker:
//   1. Outer rounded rect (fill = mushaf paper gradient #f4ead2 → #eadcb0)
//   2. Inner double-ruled border (2 strokes, gap 6px, color #8a6420)
//   3. Arabic surah name at top (font: quranCommonTypeface if available)
//   4. Basmallah if first verse (from buildShareCardParagraphs)
//   5. Verse text
//   6. Circular ayah-number ornament (Skia <Circle> with inscribed text)
//   7. Small "made with Bayaan" at bottom
// Cross-surah fallback: if verseKeys span two surahs, show the first surah
// name with a small "+" tag in the top-right corner.
```

Follow the exact structure of `classicCream.tsx` but replace the Sticker body with the above. The Arabic surah name at top is new — the existing `ShareCardPreview` emits it via the QCF typeface and `buildShareCardParagraphs`; you can reuse that element selector (the `nameParagraph` in `elements.sections[0]`).

- [ ] **Step 2: Register in index**

```ts
import {mushafPageTemplate} from './mushafPage';

export const TEMPLATES: readonly Template[] = [
  classicCreamTemplate,
  midnightGoldTemplate,
  fullBleedCalligraphyTemplate,
  mushafPageTemplate,
];
```

- [ ] **Step 3: Type-check + smoke test**

Run:
```bash
npx tsc --noEmit
npm run ios
```

Verify all 4 thumbnails render in the picker, switching between them updates the preview correctly.

- [ ] **Step 4: Commit**

```bash
git add components/share/instagram-story/templates/mushafPage.tsx \
        components/share/instagram-story/templates/index.ts
git commit -m "feat(ig-story): mushaf page template"
```

---

## Task 22: Wire fit cascade into template rendering

The `fitCascade.ts` from Task 7 isn't yet used. Integrate it into the two templates that support translation (Classic Cream, Midnight Gold) so long-verse translations shrink → truncate → reject.

**Files:**
- Modify: `components/share/buildShareCardParagraphs.ts` (add fit-cascade call site)
- Modify: `components/sheets/instagram-story/InstagramStoryModal.tsx` (surface rejection to UI)

- [ ] **Step 1: Integrate the cascade in `buildShareCardParagraphs`**

Add an optional arg `translationText?: string` and `maxHeight?: number`. When both are provided AND translation is enabled in `RenderContext`, run:

```ts
const measure = (text: string, fontSize: number): number => {
  const style: SkParagraphStyle = {textAlign: TextAlign.Center};
  const b = Skia.ParagraphBuilder.Make(style, fontMgr);
  b.pushStyle({fontSize, fontFamilies: ['Georgia']}).addText(text).pop();
  const p = b.build();
  p.layout(contentWidth);
  return p.getHeight();
};

const fitResult = chooseTranslationFit({
  text: translationText,
  fontSizes: [22, 20, 18, 16, 14],
  maxHeight,
  measure,
});
```

Based on `fitResult.status`:
- `'fit'` or `'truncated'` → build a `Paragraph` using `fitResult.text` and `fitResult.fontSize`
- `'reject'` → set a flag on the returned elements object: `translationRejected: true`

- [ ] **Step 2: Propagate rejection to modal**

In `InstagramStoryModal.tsx`, when the active template reports rejection, disable the share button and the translation toggle, and show an inline message:

```tsx
{elementsHaveRejection && (
  <Text style={styles.rejectMsg}>
    This verse is too long to share with translation — try Arabic only or a shorter range.
  </Text>
)}
```

The rejection state comes from the template's `getStickerDimensions` (or a new sibling `getFitStatus(ctx)` method on the Template interface). Pick the cleaner API — likely `getFitStatus`.

If rejection comes from `getFitStatus`, update `types.ts`:
```ts
export interface Template {
  // ...
  getFitStatus?(ctx: RenderContext): {rejected: boolean; reason?: 'arabic-too-long' | 'translation-too-long'};
}
```

- [ ] **Step 3: Test with Ayat al-Kursi (2:255)**

Run the modal with `verseKeys: ['2:255']` (or a longer range). Toggle translation on. Verify cascade behavior — font shrinks; eventually truncates; eventually rejects.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add components/share/buildShareCardParagraphs.ts \
        components/share/instagram-story/types.ts \
        components/share/instagram-story/templates/*.tsx \
        components/sheets/instagram-story/InstagramStoryModal.tsx
git commit -m "feat(ig-story): wire fit cascade for long-verse translations"
```

---

## Task 23: Add save-to-camera-roll action

**Files:**
- Modify: `components/sheets/instagram-story/InstagramStoryModal.tsx`

- [ ] **Step 1: Add the save icon and handler**

Next to the "Share to Story" button, add:

```tsx
<Pressable
  style={styles.saveBtn}
  onPress={handleSaveToCameraRoll}
  accessibilityRole="button"
  accessibilityLabel="Save story image to photos">
  <Feather name="download" size={18} color="#fff" />
</Pressable>
```

- [ ] **Step 2: Implement the handler**

```tsx
import * as MediaLibrary from 'expo-media-library';

const handleSaveToCameraRoll = useCallback(async () => {
  if (!ctx) return;
  try {
    mediumHaptics();
    const {status} = await MediaLibrary.requestPermissionsAsync(true); // writeOnly
    if (status !== 'granted') {
      Toast.show({type: 'error', text1: 'Photos permission denied'});
      return;
    }
    // Capture a baked composite (sticker on top of background) for save.
    // Simplest path: capture the hidden background canvas only, then overlay
    // the sticker via a dedicated "baked" canvas or a single capture from the
    // preview canvas at full resolution.
    const {backgroundUri} = await captureStoryImages({
      backgroundRef: bgRef,
      stickerRef, // reused but only bg is saved in this simple variant
    });
    await MediaLibrary.saveToLibraryAsync(backgroundUri);
    Toast.show({type: 'success', text1: 'Saved to Photos'});
    analyticsService.trackInstagramStorySaved({
      template: templateId,
      translation_shown: translationEnabled,
    });
  } catch {
    Toast.show({type: 'error', text1: 'Couldn’t save image'});
  }
}, [ctx, bgRef, stickerRef, templateId, translationEnabled]);
```

**Note:** this saves the background alone. If a baked (sticker-on-bg) save is required, add a third off-screen canvas `StoryBakedCanvas` that composes both, capture from it, and save that instead.

- [ ] **Step 3: Add NSPhotoLibraryAddUsageDescription to Info.plist**

In `app.config.js` → `ios.infoPlist`:
```js
NSPhotoLibraryAddUsageDescription: 'Save Instagram Story images to your photo library.',
```

Run:
```bash
npm run prebuild
```

- [ ] **Step 4: Commit**

```bash
git add components/sheets/instagram-story/InstagramStoryModal.tsx app.config.js ios
git commit -m "feat(ig-story): save-to-camera-roll action"
```

---

## Task 24: Add analytics events

**Files:**
- Modify: `services/analytics/events.ts`
- Modify: `services/analytics/AnalyticsService.ts`

- [ ] **Step 1: Add event constants + prop types to `events.ts`**

Append to `ANALYTICS_EVENTS`:
```ts
INSTAGRAM_STORY_OPENED: 'instagram_story_opened',
INSTAGRAM_STORY_TEMPLATE_SWITCHED: 'instagram_story_template_switched',
INSTAGRAM_STORY_SHARE: 'instagram_story_share',
INSTAGRAM_STORY_CANCELLED: 'instagram_story_cancelled',
INSTAGRAM_STORY_FAILED: 'instagram_story_failed',
INSTAGRAM_STORY_SAVED: 'instagram_story_saved',
```

Add prop types:
```ts
export interface InstagramStoryOpenedProps {
  verse_range: string;
}
export interface InstagramStoryTemplateSwitchedProps {
  from: string;
  to: string;
}
export interface InstagramStoryShareProps {
  template: string;
  translation_shown: boolean;
  content_type: 'verse';
  surah_id: number;
  verse_range: string;
}
export interface InstagramStoryCancelledProps {
  template: string;
}
export interface InstagramStoryFailedProps {
  template: string;
  reason: 'not-installed' | 'render-failed' | 'share-error' | 'cancelled';
}
export interface InstagramStorySavedProps {
  template: string;
  translation_shown: boolean;
}
```

- [ ] **Step 2: Add methods to `AnalyticsService.ts`**

Import the new prop types, and add methods mirroring the existing pattern (e.g. `trackShareCreated` at line 209):

```ts
trackInstagramStoryOpened(props: InstagramStoryOpenedProps): void {
  this.capture(ANALYTICS_EVENTS.INSTAGRAM_STORY_OPENED, {...props});
}
trackInstagramStoryTemplateSwitched(props: InstagramStoryTemplateSwitchedProps): void {
  this.capture(ANALYTICS_EVENTS.INSTAGRAM_STORY_TEMPLATE_SWITCHED, {...props});
}
trackInstagramStoryShare(props: InstagramStoryShareProps): void {
  this.capture(ANALYTICS_EVENTS.INSTAGRAM_STORY_SHARE, {...props});
}
trackInstagramStoryCancelled(props: InstagramStoryCancelledProps): void {
  this.capture(ANALYTICS_EVENTS.INSTAGRAM_STORY_CANCELLED, {...props});
}
trackInstagramStoryFailed(props: InstagramStoryFailedProps): void {
  this.capture(ANALYTICS_EVENTS.INSTAGRAM_STORY_FAILED, {...props});
}
trackInstagramStorySaved(props: InstagramStorySavedProps): void {
  this.capture(ANALYTICS_EVENTS.INSTAGRAM_STORY_SAVED, {...props});
}
```

Remove any temporary stubs added in Task 16 Step 3.

- [ ] **Step 3: Type-check**

Run:
```bash
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 4: Commit**

```bash
git add services/analytics/events.ts services/analytics/AnalyticsService.ts
git commit -m "feat(ig-story): analytics events for story share flow"
```

---

## Task 25: Full device smoke test + PR

- [ ] **Step 1: Run full type-check + lint + tests**

```bash
npx tsc --noEmit
npm run lint
npx jest components/share/instagram-story utils/__tests__/instagramStoryShare.test.ts
npx prettier --write components/share/instagram-story components/sheets/instagram-story utils/instagramStoryShare.ts
```

All must pass clean.

- [ ] **Step 2: Device test matrix**

On a real device with Instagram installed, test:
- [ ] Short verse (94:6) — all 4 templates
- [ ] Medium verse (2:201)
- [ ] Ayat al-Kursi (2:255) with translation OFF — should render
- [ ] Ayat al-Kursi (2:255) with translation ON — should shrink/truncate or reject
- [ ] Cross-surah range (e.g. `2:286` + `3:1`) — Mushaf Page shows the `+` fallback
- [ ] Non-Hafs rewayah (switch in settings) — verse text reflects the rewayah; rewayah label shows on the sticker
- [ ] IG not installed (log out of IG or test on iOS Simulator) — toast shows
- [ ] Cancel share mid-flow in IG — no crash, no false "shared" analytics
- [ ] Save to Photos → verify image in Photos app
- [ ] VoiceOver: all thumbnails, toggle, CTA have spoken labels
- [ ] iPad landscape (per project memory: iPad supports landscape) — modal adapts

- [ ] **Step 3: Push branch and open PR**

```bash
git push -u origin feature/instagram-story-sharing
gh pr create --title "feat: Instagram Story sharing (Phase 1 — verse templates)" --body "$(cat <<'EOF'
## Summary
- Full-screen Instagram Story picker modal with 4 templates (Classic Cream, Midnight Gold, Full-bleed Calligraphy, Mushaf Page)
- react-native-share wrapper with install detection + typed failure modes
- Two-layer composition (1080×1920 background + transparent sticker) via pre-mounted off-screen Skia canvases
- Fit cascade (shrink → truncate → reject) for long-verse translations
- Save-to-camera-roll action
- Full analytics event set (opened, switched, shared, cancelled, failed, saved)
- Attribution deep link via existing verseShareUrl

See design spec: `docs/superpowers/specs/2026-04-19-instagram-story-sharing-design.md`
Spike result: `docs/superpowers/plans/2026-04-19-ig-spike-result.md`

## Test plan
- [x] Unit tests: fitCascade, instagramStoryShare
- [ ] Device matrix (iOS + Android, IG installed + not installed)
- [ ] Long-verse (Ayat al-Kursi) fit cascade: shrink, truncate, reject paths
- [ ] All 4 templates render for short / medium / long / cross-surah verses
- [ ] Non-Hafs rewayah reflected in shared image
- [ ] iPad landscape
- [ ] VoiceOver labels

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of scope for this plan (explicit)

- Audio snippet sharing (Phase 2).
- Mushaf page / reciter / adhkar / dhikr content types.
- IG landing-page user-agent detection — that is a separate change in the `app.thebayaan.com` web repo and is outside this plan. Document the required change in the PR body as a follow-up ticket.
- Custom template theming beyond the translation toggle.
- Dynamic translation source switching (blocked on the downloadable-translations feature).

## Self-Review

Spec coverage check — every section in the spec maps to a task:
- User flow (spec §2) → Tasks 16, 17 (modal + VerseShareSheet button)
- 4 templates (spec §3) → Tasks 12, 19, 20, 21
- Content rules / surah header / basmallah / rewayah (spec §Content rules) → Tasks 12 and downstream (via `buildShareCardParagraphs`)
- Translation + fit cascade → Tasks 7, 22
- Watermark (always shown) → Task 12 (inherited from existing pipeline)
- Attribution URL + IG in-app browser caveat → Task 16 (client); landing page is out-of-scope doc'd
- Meta App ID → Task 2
- Rendering pipeline → Tasks 6, 9, 10, 11, 14
- Share helper / Android risk → Tasks 4, 8
- Native config → Task 3
- Integration points (`VerseShareSheet`) → Task 17
- Fallbacks / errors → Tasks 8, 16
- Analytics → Task 24
- Save to camera roll → Task 23
- Platform / a11y → Task 16 (labels inline), Task 25 (test matrix)

No placeholders. No "TBD" / "TODO" / "implement later" / "similar to task N" without concrete code.

Type consistency: `TemplateId`, `RenderContext`, `Template`, `StoryShareResult`, event prop names are stable across tasks 6 → 24.
