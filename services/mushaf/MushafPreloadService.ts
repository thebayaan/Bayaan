import {
  Skia,
  type SkTypefaceFontProvider,
  type SkTypeface,
} from '@shopify/react-native-skia';
import {Image} from 'react-native';
import {digitalKhattDataService} from './DigitalKhattDataService';
import {quranTextService} from './QuranTextService';
import {rewayahDiffService} from './RewayahDiffService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {migratePersistedId} from '@/services/rewayah/RewayahIdentity';

const FONT_ASSETS: Record<string, number> = {
  DigitalKhattV1: require('@/data/mushaf/legacy/DigitalKhattQuranicV1.otf'),
  DigitalKhattV2: require('@/data/mushaf/digitalkhatt/DigitalKhattFont.otf'),
  DigitalKhattIndoPak: require('@/data/mushaf/indopak/DigitalKhattIndoPak.otf'),
  QuranCommon: require('@/data/mushaf/quran-common.ttf'),
  SurahNameV4: require('@/data/mushaf/surah-name-v4.ttf'),
  SurahNameQCF: require('@/data/mushaf/surah-name-qcf.ttf'),
  ManropeSemiBold: require('@/assets/fonts/Manrope-SemiBold.ttf'),
  ManropeRegular: require('@/assets/fonts/Manrope-Regular.ttf'),
};

/**
 * Preloads everything the Mushaf screen needs at app startup (AppInitializer
 * priority 5). By the time the user navigates to the Mushaf tab, fonts and
 * DK data are available synchronously; no loading spinners.
 *
 * - DigitalKhatt SQLite data (word + layout databases)
 * - Skia TypefaceFontProvider with DK + ornamental fonts (for SkiaPage rendering)
 */
/**
 * Lifecycle state for the preload pipeline. Surfaced to subscribers so
 * they can distinguish "still loading" (render nothing) from "failed"
 * (render via fallback / system fonts) without re-reading singletons.
 */
export type MushafPreloadState = 'idle' | 'loading' | 'ready' | 'failed';

class MushafPreloadService {
  private _fontMgr: SkTypefaceFontProvider | null = null;
  private _quranCommonTypeface: SkTypeface | null = null;
  private _surahNameTypeface: SkTypeface | null = null;
  private _state: MushafPreloadState = 'idle';
  private _initPromise: Promise<void> | null = null;
  // `useSyncExternalStore` subscribers so mushaf components can read
  // fontMgr synchronously without needing a useFonts fallback that races
  // at first-mount.
  private _listeners = new Set<() => void>();

  /** Subscribe to font-preload completion. Returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _notify(): void {
    for (const fn of this._listeners) fn();
  }

  /** `true` once `_doInit` ran to completion, regardless of success/failure. */
  get initialized(): boolean {
    return this._state === 'ready' || this._state === 'failed';
  }

  /**
   * `true` if any step of `_doInit` rejected or `loadSkiaFonts` swallowed an
   * error. Consumers (see `useMushafFontMgr`) can switch to a fallback render
   * path to avoid a permanently-blank Mushaf when the preload fails.
   */
  get loadError(): boolean {
    return this._state === 'failed';
  }

  get state(): MushafPreloadState {
    return this._state;
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
    if (this._state === 'ready') return;
    // Allow a retry after a prior failure (Osman review LOW): the previous
    // implementation cached the rejected promise forever, so a later call
    // got the same rejection with no way to recover. Also explicitly
    // reset typeface/fontMgr fields so the invariant "retry starts from
    // a clean slate" is in the code, not implicit on the second run's
    // overwrites. Otherwise a fallback-then-retry sequence could observe
    // a stale `_quranCommonTypeface` mid-init.
    if (this._state === 'failed') {
      this._initPromise = null;
      this._state = 'idle';
      this._fontMgr = null;
      this._quranCommonTypeface = null;
      this._surahNameTypeface = null;
    }
    if (this._initPromise) return this._initPromise;

    this._state = 'loading';
    this._initPromise = this._doInit();
    return this._initPromise;
  }

  private async _doInit(): Promise<void> {
    let failed = false;
    try {
      // Wait for Zustand persist hydration so DK service reads the user's
      // saved rewayah rather than the default (otherwise a reloaded app with
      // Shu'bah persisted would briefly init against Hafs and never catch up).
      await waitForSettingsHydration();

      // Defensive normalization at the earliest hydration-complete point.
      // If a stale pre-canonical slug ("qaloon", "shouba", etc.) slipped
      // past the v12→v13 migration (e.g. an intermediate build that bumped
      // the version without running the slug migrator), rewrite the store
      // to the canonical slug before any reader pulls it. Keeps every
      // downstream consumer; not just the DK service; on safe values.
      const store = useMushafSettingsStore.getState();
      const normalized = migratePersistedId(store.rewayah as unknown as string);
      if (normalized !== store.rewayah) {
        store.setRewayah(normalized);
      }

      // DK data must be ready first; page lines are needed for layout computation
      await digitalKhattDataService.initialize();

      // Load rewayah diff ranges for the current rewayah, then keep in sync.
      // On switch the line-text caches and diff cache must be cleared before
      // SkiaPage re-renders so line text and highlight offsets are recomputed.
      rewayahDiffService.loadForRewayah(digitalKhattDataService.rewayah);
      digitalKhattDataService.onRewayahChange(rewayah => {
        quranTextService.clearCaches();
        rewayahDiffService.loadForRewayah(rewayah);
      });

      await this.loadSkiaFonts();

      // `loadSkiaFonts` swallows its own errors and leaves `_fontMgr` null on
      // failure. Treat a null fontMgr after the load completes as a failure
      // so subscribers can flip to the fallback path.
      if (!this._fontMgr) {
        failed = true;
      }
    } catch (error) {
      // Any pre-font init step rejected (hydration, DK init, diff load). The
      // outer init must NOT swallow the rejection silently — surface it as
      // `failed` so subscribers render the fallback rather than a blank UI.
      failed = true;
      console.warn('[MushafPreload] Initialization failed:', error);
    } finally {
      // Always transition to a terminal state and always notify. Without the
      // `finally` block a mid-pipeline rejection would leave `_state` at
      // 'loading' forever and never wake subscribed components.
      this._state = failed ? 'failed' : 'ready';
      this._notify();
      console.log(`[MushafPreload] Initialization ${this._state}`);
    }
  }

  private async loadSkiaFonts(): Promise<void> {
    try {
      const fontMgr = Skia.TypefaceFontProvider.Make();
      let anyFailed = false;

      for (const [family, asset] of Object.entries(FONT_ASSETS)) {
        const uri = Image.resolveAssetSource(asset).uri;
        const data = await Skia.Data.fromURI(uri);
        const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
        if (!typeface) {
          anyFailed = true;
          console.warn(
            `[MushafPreload] Failed to create typeface for ${family}`,
          );
          continue;
        }
        if (family === 'QuranCommon') this._quranCommonTypeface = typeface;
        if (family === 'SurahNameV4') this._surahNameTypeface = typeface;
        fontMgr.registerFont(typeface, family);
      }

      // Only publish the fontMgr if every critical family registered. A
      // partial register would render some surahs with missing glyphs; the
      // fallback retry below produces a fully-populated provider or none.
      if (!anyFailed) {
        this._fontMgr = fontMgr;
        return;
      }
      console.warn(
        '[MushafPreload] Partial typeface failure on primary load; retrying sequentially',
      );
    } catch (error) {
      console.warn('[MushafPreload] Failed to load Skia fonts:', error);
    }

    // Fallback retry path: serialize the load with `await` between each
    // typeface registration. The original symptom Osman reviewed was
    // "Couldn't create typeface for SurahNameV4" — parallel typeface
    // registration is the root cause, so the retry forces strict serial
    // ordering. If the retry also fails, `_fontMgr` stays null and
    // `_doInit` flips state to 'failed' so consumers know not to wait
    // forever.
    await this.loadSkiaFontsSequentialFallback();
  }

  private async loadSkiaFontsSequentialFallback(): Promise<void> {
    // Mushaf-critical families: at least one DK variant + QuranCommon must
    // register or the Mushaf renders blank. SurahName fonts are ornamental
    // (surah header glyphs); their absence is cosmetic, not catastrophic.
    // Tracked separately so a fallback that drops only ornamental fonts
    // still publishes a usable provider.
    const CRITICAL_FAMILIES = new Set([
      'DigitalKhattV1',
      'DigitalKhattV2',
      'DigitalKhattIndoPak',
      'QuranCommon',
    ]);
    try {
      const fontMgr = Skia.TypefaceFontProvider.Make();
      const registered = new Set<string>();
      let anyCriticalFailed = false;

      for (const [family, asset] of Object.entries(FONT_ASSETS)) {
        try {
          const uri = Image.resolveAssetSource(asset).uri;
          const data = await Skia.Data.fromURI(uri);
          const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
          if (!typeface) {
            console.warn(
              `[MushafPreload] Fallback failed for ${family}, skipping`,
            );
            if (CRITICAL_FAMILIES.has(family)) anyCriticalFailed = true;
            continue;
          }
          if (family === 'QuranCommon') this._quranCommonTypeface = typeface;
          if (family === 'SurahNameV4') this._surahNameTypeface = typeface;
          fontMgr.registerFont(typeface, family);
          registered.add(family);
        } catch (err) {
          console.warn(
            `[MushafPreload] Fallback exception for ${family}:`,
            err,
          );
          if (CRITICAL_FAMILIES.has(family)) anyCriticalFailed = true;
        }
      }

      // Only publish if every critical family registered AND at least one
      // typeface landed. A zero-typeface provider is a non-null empty
      // object — assigning it would pass `_doInit`'s null-guard, flip
      // `_state` to 'ready' with `loadError === false`, and the hook's
      // fallback (`useFonts`) would never fire. Result: every consumer
      // gets the empty provider, every Mushaf surface renders blank, no
      // recovery. Leaving `_fontMgr` null on critical-typeface failure
      // makes the null-guard fire so the hook's `useFonts` fallback
      // activates per Osman review HIGH.
      if (anyCriticalFailed || registered.size === 0) {
        console.warn(
          '[MushafPreload] Sequential fallback dropped critical typefaces; leaving _fontMgr null so useFonts fallback activates',
        );
        return;
      }
      this._fontMgr = fontMgr;
    } catch (error) {
      console.warn('[MushafPreload] Sequential fallback rejected:', error);
    }
  }
}

export const mushafPreloadService = new MushafPreloadService();

function waitForSettingsHydration(): Promise<void> {
  const persist = useMushafSettingsStore.persist;
  if (persist.hasHydrated()) return Promise.resolve();
  return new Promise<void>(resolve => {
    const unsub = persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}
