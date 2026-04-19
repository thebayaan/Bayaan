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
