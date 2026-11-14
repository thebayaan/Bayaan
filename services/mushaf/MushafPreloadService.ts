import {
  Skia,
  type SkTypefaceFontProvider,
  type SkTypeface,
} from '@shopify/react-native-skia';
import {Image} from 'react-native';
import {digitalKhattDataService} from './DigitalKhattDataService';
import {quranTextService} from './QuranTextService';
import {rewayahDiffService} from './RewayahDiffService';
import {
  useMushafSettingsStore,
  type RewayahId,
} from '@/store/mushafSettingsStore';
import {migratePersistedId} from '@/services/rewayah/RewayahIdentity';

// @ai-start
const FONT_ASSETS = {
  DigitalKhattV1: require('@/data/mushaf/legacy/DigitalKhattQuranicV1.otf'),
  DigitalKhattV2: require('@/data/mushaf/digitalkhatt/DigitalKhattFont.otf'),
  DigitalKhattIndoPak: require('@/data/mushaf/indopak/DigitalKhattIndoPak.otf'),
  QuranCommon: require('@/data/mushaf/quran-common.ttf'),
  SurahNameV4: require('@/data/mushaf/surah-name-v4.ttf'),
  SurahNameQCF: require('@/data/mushaf/surah-name-qcf.ttf'),
  ManropeSemiBold: require('@/assets/fonts/Manrope-SemiBold.ttf'),
  ManropeRegular: require('@/assets/fonts/Manrope-Regular.ttf'),
  PlexSansArabicSemiBold: require('@/assets/fonts/IBMPlexSansArabic-SemiBold.ttf'),
} satisfies Record<string, number>;

type FontFamily = keyof typeof FONT_ASSETS;

// The Mushaf draws nothing without these. A surah name or UI font that fails
// is skipped: its absence is cosmetic.
const REQUIRED_FAMILIES: readonly FontFamily[] = [
  'DigitalKhattV1',
  'DigitalKhattV2',
  'DigitalKhattIndoPak',
  'QuranCommon',
];
// @ai-end

function assetUri(asset: number): string {
  const source = Image.resolveAssetSource(asset);
  if (!source) {
    throw new Error(`Unresolvable font asset ${asset}`);
  }
  return source.uri;
}

// @ai-start
async function readTypeface(family: FontFamily): Promise<SkTypeface | null> {
  try {
    const data = await Skia.Data.fromURI(assetUri(FONT_ASSETS[family]));
    const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
    if (typeface) return typeface;
    console.warn(`[MushafPreload] Failed to create typeface for ${family}`);
  } catch (error) {
    console.warn(`[MushafPreload] Failed to read the font ${family}:`, error);
  }
  return null;
}
// @ai-end

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
  // Registered once (a retried init must not stack listeners).
  private _rewayahSubscription: (() => void) | null = null;
  private _diffRewayah: RewayahId | null = null;
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
    // got the same rejection with no way to recover.
    // @ai A retry keeps fonts that loaded, so the pages stay drawn while it
    // runs. `loadSkiaFonts` sets the provider and its typefaces together, so
    // no part of a failed load is left to clear.
    if (this._state === 'failed') {
      this._initPromise = null;
      this._state = 'idle';
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

      // Keep line-text/layout caches and diff ranges in step with the DK
      // service. The listener runs synchronously inside each commit that
      // changes the active rewayah (after the maps are swapped, before cache
      // subscribers re-render), so SkiaPage never recomputes line text or
      // highlight offsets from the previous rewayah's caches. Registered
      // before initialize() so the first commit (when the persisted rewayah
      // is not Hafs, or a bookmark switch landed first) is covered too.
      if (!this._rewayahSubscription) {
        this._rewayahSubscription = digitalKhattDataService.onRewayahChange(
          rewayah => {
            quranTextService.clearCaches();
            this._loadDiffsFor(rewayah);
          },
        );
      }

      // DK data must be ready first; page lines are needed for layout computation
      await digitalKhattDataService.initialize();

      // Hafs (the service's starting rewayah) commits without a change event.
      this._loadDiffsFor(digitalKhattDataService.rewayah);
    } catch (error) {
      // Any pre-font init step rejected (hydration, DK init, diff load). The
      // outer init must NOT swallow the rejection silently — surface it as
      // `failed` so subscribers render the fallback rather than a blank UI.
      failed = true;
      console.warn('[MushafPreload] Initialization failed:', error);
    }
    try {
      // @ai The fonts need no Mushaf data, so a failed data step still loads
      // them for the readers that draw without it. A retry keeps fonts that
      // loaded. `loadSkiaFonts` swallows its own errors and leaves `_fontMgr`
      // null on failure.
      if (!this._fontMgr) await this.loadSkiaFonts();
    } finally {
      // Always transition to a terminal state and always notify. Without the
      // `finally` block a mid-pipeline rejection would leave `_state` at
      // 'loading' forever and never wake subscribed components.
      this._state = failed || !this._fontMgr ? 'failed' : 'ready'; // @ai
      this._notify();
      console.log(`[MushafPreload] Initialization ${this._state}`);
    }
  }

  private _loadDiffsFor(rewayah: RewayahId): void {
    if (this._diffRewayah === rewayah) return;
    rewayahDiffService.loadForRewayah(rewayah);
    this._diffRewayah = rewayah;
  }

  // @ai-start
  // The one font loader, for the first load and for a retry. It reads one
  // font at a time. A font that fails is read once more, then skipped. The
  // provider is published only when every required family registered, and
  // its typefaces with it, so a reader never sees a part of a load.
  private async loadSkiaFonts(): Promise<void> {
    try {
      const fontMgr = Skia.TypefaceFontProvider.Make();
      const loaded = new Map<FontFamily, SkTypeface>();
      for (const family of Object.keys(FONT_ASSETS) as FontFamily[]) {
        const typeface =
          (await readTypeface(family)) ?? (await readTypeface(family));
        if (!typeface) continue;
        fontMgr.registerFont(typeface, family);
        loaded.set(family, typeface);
      }
      const missing = REQUIRED_FAMILIES.filter(family => !loaded.has(family));
      if (missing.length > 0) {
        console.warn(
          `[MushafPreload] Required fonts did not load: ${missing.join(', ')}`,
        );
        return;
      }
      this._quranCommonTypeface = loaded.get('QuranCommon') ?? null;
      this._surahNameTypeface = loaded.get('SurahNameV4') ?? null;
      this._fontMgr = fontMgr;
    } catch (error) {
      console.warn('[MushafPreload] Failed to load Skia fonts:', error);
    }
  }
  // @ai-end
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
