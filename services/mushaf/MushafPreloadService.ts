import {
  Skia,
  type SkTypefaceFontProvider,
  type SkTypeface,
} from '@shopify/react-native-skia';
import {Image} from 'react-native';
import {digitalKhattDataService} from './DigitalKhattDataService';

const FONT_ASSETS: Record<string, number> = {
  DigitalKhattV1: require('@/data/mushaf/legacy/DigitalKhattQuranicV1.otf'),
  DigitalKhattV2: require('@/data/mushaf/digitalkhatt/DigitalKhattV2.otf'),
  QuranCommon: require('@/data/mushaf/quran-common.ttf'),
  SurahNameV4: require('@/data/mushaf/surah-name-v4.ttf'),
  SurahNameQCF: require('@/data/mushaf/surah-name-qcf.ttf'),
  ManropeSemiBold: require('@/assets/fonts/Manrope-SemiBold.ttf'),
};

/**
 * Preloads everything the Mushaf screen needs at app startup (AppInitializer
 * priority 5). By the time the user navigates to the Mushaf tab, fonts and
 * DK data are available synchronously — no loading spinners.
 *
 * - DigitalKhatt SQLite data (word + layout databases)
 * - Skia TypefaceFontProvider with DK + ornamental fonts (for SkiaPage rendering)
 */
class MushafPreloadService {
  private _fontMgr: SkTypefaceFontProvider | null = null;
  private _quranCommonTypeface: SkTypeface | null = null;
  private _surahNameTypeface: SkTypeface | null = null;
  private _initialized = false;
  private _initPromise: Promise<void> | null = null;

  get initialized(): boolean {
    return this._initialized;
  }

  get fontMgr(): SkTypefaceFontProvider | null {
    return this._fontMgr;
  }

  get quranCommonTypeface(): SkTypeface | null {
    return this._quranCommonTypeface;
  }

  get surahNameTypeface(): SkTypeface | null {
    return this._surahNameTypeface;
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

    await this.loadSkiaFonts();

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
        if (family === 'QuranCommon') this._quranCommonTypeface = typeface;
        if (family === 'SurahNameV4') this._surahNameTypeface = typeface;
        fontMgr.registerFont(typeface, family);
        console.log(
          `[MushafPreload] Registered ${family}, typeface null? ${!typeface}`,
        );
      }

      this._fontMgr = fontMgr;
    } catch (error) {
      console.warn('[MushafPreload] Failed to load Skia fonts:', error);
    }
  }
}

export const mushafPreloadService = new MushafPreloadService();
