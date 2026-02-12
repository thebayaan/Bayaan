import {Skia, type SkTypefaceFontProvider} from '@shopify/react-native-skia';
import {Image} from 'react-native';
import * as Font from 'expo-font';
import {digitalKhattDataService} from './DigitalKhattDataService';

const FONT_ASSETS: Record<string, number> = {
  DigitalKhattV1: require('@/data/mushaf/legacy/DigitalKhattQuranicV1.otf'),
  DigitalKhattV2: require('@/data/mushaf/digitalkhatt/DigitalKhattV2.otf'),
};

const SURAH_HEADER_FONT = require('@/data/mushaf/legacy/SURAH_HEADERS.ttf');

/**
 * Preloads everything the Mushaf screen needs at app startup (AppInitializer
 * priority 5). By the time the user navigates to the Mushaf tab, fonts and
 * DK data are available synchronously — no loading spinners.
 *
 * - DigitalKhatt SQLite data (word + layout databases)
 * - Skia TypefaceFontProvider with V1 + V2 fonts (for SkiaPage rendering)
 * - SURAH_HEADERS expo-font (for surah name overlays)
 */
class MushafPreloadService {
  private _fontMgr: SkTypefaceFontProvider | null = null;
  private _surahHeaderFontLoaded = false;
  private _initialized = false;
  private _initPromise: Promise<void> | null = null;

  get initialized(): boolean {
    return this._initialized;
  }

  get fontMgr(): SkTypefaceFontProvider | null {
    return this._fontMgr;
  }

  get surahHeaderFontLoaded(): boolean {
    return this._surahHeaderFontLoaded;
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doInit();
    return this._initPromise;
  }

  private async _doInit(): Promise<void> {
    // DK data must be ready first — page lines are needed for layout computation
    await digitalKhattDataService.initialize();

    // Load Skia font providers and surah header font in parallel
    await Promise.all([this.loadSkiaFonts(), this.loadSurahHeaderFont()]);

    this._initialized = true;
    console.log('[MushafPreload] Initialization complete');
  }

  private async loadSkiaFonts(): Promise<void> {
    try {
      const fontMgr = Skia.TypefaceFontProvider.Make();

      for (const [family, asset] of Object.entries(FONT_ASSETS)) {
        const uri = Image.resolveAssetSource(asset).uri;
        const data = await Skia.Data.fromURI(uri);
        const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
        if (!typeface) {
          console.warn(
            `[MushafPreload] Failed to create typeface for ${family}`,
          );
          continue;
        }
        fontMgr.registerFont(typeface, family);
      }

      this._fontMgr = fontMgr;
    } catch (error) {
      console.warn('[MushafPreload] Failed to load Skia fonts:', error);
    }
  }

  private async loadSurahHeaderFont(): Promise<void> {
    try {
      await Font.loadAsync({
        SURAH_HEADERS: SURAH_HEADER_FONT,
      });
      this._surahHeaderFontLoaded = true;
    } catch (error) {
      console.warn('[MushafPreload] Failed to load surah header font:', error);
    }
  }
}

export const mushafPreloadService = new MushafPreloadService();
