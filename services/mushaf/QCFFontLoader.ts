// @ai-start
// On-demand QCF V2 / V4 tajweed page-font loader. The full V2 payload is ~200 MB
// (TTF), so bundling is impractical. Each font is downloaded once into the
// app's documentDirectory on first use of that page, then registered on
// the shared Skia TypefaceFontProvider. Subsequent requests for the same
// page resolve synchronously.
//
// Each variant has its own family; V4 day/night share one downloaded font.

import * as FileSystem from 'expo-file-system/legacy';
import {File} from 'expo-file-system';
import {Skia, type SkTypefaceFontProvider} from '@shopify/react-native-skia';
import {withQCFDarkPalette} from './QCFColorPalette';

const TOTAL_PAGES = 604;
const REMOTE_BASE =
  'https://raw.githubusercontent.com/nuqayah/qpc-fonts/master/mushaf-v2';
const TAJWEED_REMOTE_BASE =
  'https://static-cdn.tarteel.ai/qul/fonts/quran_fonts/v4-tajweed/ttf';
const LOCAL_DIR = `${FileSystem.documentDirectory}qcf-fonts/`;

export type QCFFontVariant = 'v2' | 'v4' | 'v4-dark';

export function getQCFFontVariant(
  showTajweed: boolean,
  isDark: boolean,
): QCFFontVariant {
  return showTajweed ? (isDark ? 'v4-dark' : 'v4') : 'v2';
}

export function qcfFontFamilyForPage(
  page: number,
  variant: QCFFontVariant = 'v2',
): string {
  return `p${page}-${variant}`;
}

class QCFFontLoader {
  private providers = new WeakMap<
    SkTypefaceFontProvider,
    {
      registered: Set<string>;
      inFlight: Map<string, Promise<void>>;
    }
  >();
  private downloads = new Map<string, Promise<string>>();
  private dirEnsured = false;

  isReady(
    page: number,
    fontMgr: SkTypefaceFontProvider,
    variant: QCFFontVariant = 'v2',
  ): boolean {
    return (
      this.providers
        .get(fontMgr)
        ?.registered.has(qcfFontFamilyForPage(page, variant)) ?? false
    );
  }

  async ensure(
    page: number,
    fontMgr: SkTypefaceFontProvider,
    variant: QCFFontVariant = 'v2',
  ): Promise<void> {
    if (!Number.isInteger(page) || page < 1 || page > TOTAL_PAGES) {
      throw new Error(`QCF font: page ${page} out of range`);
    }
    const family = qcfFontFamilyForPage(page, variant);
    let provider = this.providers.get(fontMgr);
    if (!provider) {
      provider = {registered: new Set(), inFlight: new Map()};
      this.providers.set(fontMgr, provider);
    }
    if (provider.registered.has(family)) return;

    const inFlight = provider.inFlight.get(family);
    if (inFlight) return inFlight;

    const task = this.loadAndRegister(page, fontMgr, variant)
      .then(() => {
        provider.registered.add(family);
      })
      .finally(() => provider.inFlight.delete(family));
    provider.inFlight.set(family, task);
    return task;
  }

  // Best-effort prefetch for nearby pages. Errors are swallowed — the
  // primary ensure() call for the visible page is what matters.
  prefetch(
    pages: number[],
    fontMgr: SkTypefaceFontProvider,
    variant: QCFFontVariant = 'v2',
  ): void {
    for (const p of pages) {
      if (p >= 1 && p <= TOTAL_PAGES && !this.isReady(p, fontMgr, variant)) {
        this.ensure(p, fontMgr, variant).catch(() => {
          // Ignore — prefetch is opportunistic
        });
      }
    }
  }

  private async loadAndRegister(
    page: number,
    fontMgr: SkTypefaceFontProvider,
    variant: QCFFontVariant,
  ): Promise<void> {
    const localUri = await this.downloadIfNeeded(page, variant);
    try {
      const data =
        variant === 'v4-dark'
          ? Skia.Data.fromBytes(
              withQCFDarkPalette(await new File(localUri).bytes()),
            )
          : await Skia.Data.fromURI(localUri);
      const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
      if (!typeface) {
        throw new Error(`QCF page ${page}: typeface creation returned null`);
      }
      fontMgr.registerFont(typeface, qcfFontFamilyForPage(page, variant));
    } catch (error) {
      // A corrupt cached font must not make every future retry fail.
      await FileSystem.deleteAsync(localUri, {idempotent: true}).catch(
        () => undefined,
      );
      throw error;
    }
  }

  private downloadIfNeeded(
    page: number,
    variant: QCFFontVariant,
  ): Promise<string> {
    const assetVariant = variant === 'v2' ? 'v2' : 'v4';
    const key = qcfFontFamilyForPage(page, assetVariant);
    const inFlight = this.downloads.get(key);
    if (inFlight) return inFlight;
    const task = this.download(page, assetVariant).finally(() =>
      this.downloads.delete(key),
    );
    this.downloads.set(key, task);
    return task;
  }

  private async download(page: number, variant: 'v2' | 'v4'): Promise<string> {
    const filename =
      variant === 'v2'
        ? `QCF2${page.toString().padStart(3, '0')}.ttf`
        : `${qcfFontFamilyForPage(page, variant)}.ttf`;
    const localUri = `${LOCAL_DIR}${filename}`;

    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists && info.size && info.size > 0) return localUri;

    await this.ensureLocalDir();

    const remoteUri =
      variant === 'v2'
        ? `${REMOTE_BASE}/${filename}`
        : `${TAJWEED_REMOTE_BASE}/p${page}.ttf`;
    const temporaryUri = `${localUri}.download`;
    try {
      const result = await FileSystem.downloadAsync(remoteUri, temporaryUri);
      if (result.status !== 200) {
        throw new Error(`QCF page ${page}: download HTTP ${result.status}`);
      }
      await FileSystem.moveAsync({from: temporaryUri, to: localUri});
    } catch (error) {
      await FileSystem.deleteAsync(temporaryUri, {idempotent: true}).catch(
        () => undefined,
      );
      throw error;
    }
    return localUri;
  }

  private async ensureLocalDir(): Promise<void> {
    if (this.dirEnsured) return;
    const info = await FileSystem.getInfoAsync(LOCAL_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(LOCAL_DIR, {intermediates: true});
    }
    this.dirEnsured = true;
  }
}

export const qcfFontLoader = new QCFFontLoader();
// @ai-end
