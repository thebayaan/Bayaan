import {createMMKV, type MMKV} from 'react-native-mmkv';
import {Skia, type SkTypefaceFontProvider} from '@shopify/react-native-skia';
import {Image} from 'react-native';

import {
  JustService,
  type JustResultByLine,
  replacer,
  reviver,
} from './JustificationService';
import {digitalKhattDataService} from './DigitalKhattDataService';
import {PAGE_WIDTH, MARGIN, FONTSIZE} from './QuranTextService';
import {CONTENT_WIDTH} from '@/components/mushaf/constants';

// Bump this when font files change or layout computation logic changes.
// Incrementing invalidates all cached layouts and forces recomputation.
const SCHEMA_VERSION = 4;
const TOTAL_PAGES = 604;

const FONT_FAMILIES = ['DigitalKhattV1', 'DigitalKhattV2'] as const;
type FontFamily = (typeof FONT_FAMILIES)[number];

const FONT_ASSETS: Record<FontFamily, number> = {
  DigitalKhattV1: require('@/data/mushaf/legacy/DigitalKhattQuranicV1.otf'),
  DigitalKhattV2: require('@/data/mushaf/digitalkhatt/DigitalKhattV2.otf'),
};

/**
 * Compute fontSizeLineWidthRatio from fixed constants.
 * Must match the computation in SkiaPage.tsx.
 */
function computeFontSizeLineWidthRatio(): number {
  const scale = CONTENT_WIDTH / PAGE_WIDTH;
  const margin = MARGIN * scale;
  const lineWidth = CONTENT_WIDTH - 2 * margin;
  const fontSize = FONTSIZE * scale * 0.9;
  return fontSize / lineWidth;
}

function mmkvKey(fontFamily: string, pageNumber: number): string {
  return `dk:${fontFamily}:${pageNumber}`;
}

function completeKey(fontFamily: string): string {
  return `dk_complete:${fontFamily}`;
}

class MushafLayoutCacheService {
  private mmkv: MMKV;
  private fontSizeLineWidthRatio: number;
  private _initialized = false;

  constructor() {
    this.mmkv = createMMKV({id: 'mushaf-layouts'});
    this.fontSizeLineWidthRatio = computeFontSizeLineWidthRatio();

    // Invalidate on schema version change
    const storedVersion = this.mmkv.getNumber('dk_schema_version');
    if (storedVersion !== SCHEMA_VERSION) {
      this.mmkv.clearAll();
      this.mmkv.set('dk_schema_version', SCHEMA_VERSION);
    }
  }

  /**
   * Synchronous read of a single page layout from MMKV.
   * Returns undefined on miss.
   */
  getPageLayout(
    pageNumber: number,
    fontFamily: string,
  ): JustResultByLine[] | undefined {
    const key = mmkvKey(fontFamily, pageNumber);
    const json = this.mmkv.getString(key);
    if (!json) return undefined;
    const parsed = JSON.parse(json, reviver) as JustResultByLine[];
    // Guard: reject empty arrays (corrupted cache from race condition)
    if (parsed.length === 0) return undefined;
    return parsed;
  }

  /**
   * Synchronous write of a single page layout to MMKV.
   */
  setPageLayout(
    pageNumber: number,
    fontFamily: string,
    data: JustResultByLine[],
  ): void {
    const key = mmkvKey(fontFamily, pageNumber);
    this.mmkv.set(key, JSON.stringify(data, replacer));
  }

  /**
   * Check whether all 604 pages are precomputed for the given font.
   */
  isComplete(fontFamily: string): boolean {
    return this.mmkv.getString(completeKey(fontFamily)) === 'true';
  }

  /**
   * Create a SkTypefaceFontProvider outside React by loading font assets manually.
   */
  private async createFontProvider(
    fontFamily: FontFamily,
  ): Promise<SkTypefaceFontProvider> {
    const asset = FONT_ASSETS[fontFamily];
    const uri = Image.resolveAssetSource(asset).uri;
    const data = await Skia.Data.fromURI(uri);
    const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
    if (!typeface) {
      throw new Error(`Failed to create typeface for ${fontFamily}`);
    }
    const fontMgr = Skia.TypefaceFontProvider.Make();
    fontMgr.registerFont(typeface, fontFamily);
    return fontMgr;
  }

  /**
   * Precompute all 604 pages for a single font, writing each to MMKV.
   * Yields to the event loop every 10 pages to avoid blocking the UI thread.
   */
  private async precomputeFont(fontFamily: FontFamily): Promise<void> {
    if (this.isComplete(fontFamily)) {
      console.log(
        `[MushafLayoutCache] ${fontFamily} already complete, skipping`,
      );
      return;
    }

    console.log(`[MushafLayoutCache] Precomputing ${fontFamily}...`);
    const startTime = Date.now();

    const fontMgr = await this.createFontProvider(fontFamily);

    for (let page = 1; page <= TOTAL_PAGES; page++) {
      // Check if already cached (partial precomputation from a previous run)
      const existing = JustService.getCachedPageLayout(
        this.fontSizeLineWidthRatio,
        page,
        fontFamily,
      );
      if (existing) {
        // Already in memory, just ensure it's in MMKV
        if (!this.mmkv.getString(mmkvKey(fontFamily, page))) {
          this.setPageLayout(page, fontFamily, existing);
        }
      } else {
        const result = JustService.getPageLayout(
          page,
          this.fontSizeLineWidthRatio,
          fontMgr,
          fontFamily,
        );
        // Guard: never cache empty results (indicates data wasn't loaded)
        if (result.length > 0) {
          this.setPageLayout(page, fontFamily, result);
        }
      }

      // Yield every 10 pages to avoid blocking UI
      if (page % 10 === 0) {
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
    }

    this.mmkv.set(completeKey(fontFamily), 'true');
    const elapsed = Date.now() - startTime;
    console.log(
      `[MushafLayoutCache] ${fontFamily} precomputation complete (${elapsed}ms)`,
    );
  }

  /**
   * Precompute both font families. Active font first, then the other.
   */
  private async precomputeAllFonts(): Promise<void> {
    // Determine active font from settings store
    let activeFont: FontFamily = 'DigitalKhattV2';
    try {
      const {useMushafSettingsStore} = require('@/store/mushafSettingsStore');
      const uthmaniFont = useMushafSettingsStore.getState().uthmaniFont;
      activeFont = uthmaniFont === 'v1' ? 'DigitalKhattV1' : 'DigitalKhattV2';
    } catch {
      // Default to V2 if store not available
    }

    const otherFont: FontFamily =
      activeFont === 'DigitalKhattV2' ? 'DigitalKhattV1' : 'DigitalKhattV2';

    await this.precomputeFont(activeFont);
    await this.precomputeFont(otherFont);

    console.log('[MushafLayoutCache] All fonts precomputed');
  }

  /**
   * Initialize the cache service. Called by AppInitializer.
   * Waits for DigitalKhattDataService (which runs in parallel as a
   * non-critical service), then runs background precomputation.
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;

    // Must wait for DK data — getPageLayout depends on it for page lines.
    // AppInitializer runs non-critical services in parallel, so DK data
    // (priority 5) may not be ready when this service (priority 8) starts.
    await digitalKhattDataService.initialize();

    await this.precomputeAllFonts();
  }

  /**
   * Clear all cached layouts (e.g., for debugging).
   */
  clearAll(): void {
    this.mmkv.clearAll();
    this.mmkv.set('dk_schema_version', SCHEMA_VERSION);
  }
}

export const mushafLayoutCacheService = new MushafLayoutCacheService();
