// @ai-start
// On-demand Mushaf 1440 page fonts (KFGQPC QCF V4, the 1441H print). Each of
// the 604 page fonts (~250 KB) is downloaded once into the app's
// documentDirectory the first time its page is shown; later requests are
// served from disk, and a loaded typeface is served synchronously.
//
// One downloaded file serves three variants, made in memory
// (QCFColorPalette.ts):
//   'v4'       tajweed colours, day palette (the file as published)
//   'v4-dark'  tajweed colours, night palette
//   'v4-mono'  plain outlines drawn in the text colour (tajweed off, and any
//              word drawn in its own colour)
//
// The pages draw glyphs straight from these typefaces (QCFPage), so they are
// not registered with a font manager. The most recently used typefaces are
// kept; older ones are released (a page still drawing one keeps it alive).

import * as FileSystem from 'expo-file-system/legacy';
import {File} from 'expo-file-system';
import {Skia, type SkTypeface} from '@shopify/react-native-skia';
import {withQCFDarkPalette, withoutQCFColor} from './QCFColorPalette';

const TOTAL_PAGES = 604;
const REMOTE_BASE =
  'https://static-cdn.tarteel.ai/qul/fonts/quran_fonts/v4-tajweed/ttf';
const LOCAL_DIR = `${FileSystem.documentDirectory}qcf-fonts/`;
// Fonts of the 1421H glyphs (QCF V2) earlier releases downloaded here.
const LEGACY_FILE = /^QCF2\d{3}\.ttf(\.download)?$/;
/** Typefaces kept in memory (a handful of pages in three variants). */
const MAX_TYPEFACES = 24;

export type QCFFontVariant = 'v4' | 'v4-dark' | 'v4-mono';

/**
 * The variant a page draws: tajweed colours in the day or night palette, or
 * plain outlines when tajweed is off.
 */
export function getQCFFontVariant(
  showTajweed: boolean,
  isDark: boolean,
): QCFFontVariant {
  if (!showTajweed) return 'v4-mono';
  return isDark ? 'v4-dark' : 'v4';
}

export function qcfFontFamilyForPage(
  page: number,
  variant: QCFFontVariant = 'v4-mono',
): string {
  return `p${page}-${variant}`;
}

class QCFFontLoader {
  private typefaces = new Map<string, SkTypeface>();
  private inFlight = new Map<string, Promise<SkTypeface>>();
  private downloads = new Map<number, Promise<string>>();
  private dirEnsured = false;
  private legacySwept = false;

  isReady(page: number, variant: QCFFontVariant = 'v4-mono'): boolean {
    return this.typefaces.has(qcfFontFamilyForPage(page, variant));
  }

  /**
   * The loaded typeface of a page variant, or null, without counting as a
   * use (safe to call while rendering).
   */
  peekTypeface(
    page: number,
    variant: QCFFontVariant = 'v4-mono',
  ): SkTypeface | null {
    return this.typefaces.get(qcfFontFamilyForPage(page, variant)) ?? null;
  }

  /** The loaded typeface of a page variant, or null (nothing is loaded). */
  getTypeface(
    page: number,
    variant: QCFFontVariant = 'v4-mono',
  ): SkTypeface | null {
    const family = qcfFontFamilyForPage(page, variant);
    const typeface = this.typefaces.get(family);
    if (!typeface) return null;
    // Most recently used last.
    this.typefaces.delete(family);
    this.typefaces.set(family, typeface);
    return typeface;
  }

  async ensure(
    page: number,
    variant: QCFFontVariant = 'v4-mono',
  ): Promise<SkTypeface> {
    if (!Number.isInteger(page) || page < 1 || page > TOTAL_PAGES) {
      throw new Error(`QCF font: page ${page} out of range`);
    }
    const ready = this.getTypeface(page, variant);
    if (ready) return ready;
    const family = qcfFontFamilyForPage(page, variant);
    const pending = this.inFlight.get(family);
    if (pending) return pending;
    const task = this.load(page, variant)
      .then(typeface => {
        this.keep(family, typeface);
        return typeface;
      })
      .finally(() => this.inFlight.delete(family));
    this.inFlight.set(family, task);
    return task;
  }

  // Best-effort prefetch of nearby pages. Errors are swallowed: the visible
  // page's own ensure() reports them.
  prefetch(pages: number[], variant: QCFFontVariant = 'v4-mono'): void {
    for (const p of pages) {
      if (p >= 1 && p <= TOTAL_PAGES && !this.isReady(p, variant)) {
        this.ensure(p, variant).catch(() => undefined);
      }
    }
  }

  private keep(family: string, typeface: SkTypeface): void {
    this.typefaces.delete(family);
    this.typefaces.set(family, typeface);
    while (this.typefaces.size > MAX_TYPEFACES) {
      const oldest = this.typefaces.keys().next().value;
      if (oldest === undefined) break;
      this.typefaces.delete(oldest);
    }
  }

  private async load(
    page: number,
    variant: QCFFontVariant,
  ): Promise<SkTypeface> {
    this.sweepLegacyFonts();
    const localUri = await this.downloadIfNeeded(page);
    try {
      const data =
        variant === 'v4'
          ? await Skia.Data.fromURI(localUri)
          : Skia.Data.fromBytes(
              (variant === 'v4-dark' ? withQCFDarkPalette : withoutQCFColor)(
                await new File(localUri).bytes(),
              ),
            );
      const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
      if (!typeface) {
        throw new Error(`QCF page ${page}: typeface creation returned null`);
      }
      return typeface;
    } catch (error) {
      // A corrupt cached font must not make every future retry fail.
      await FileSystem.deleteAsync(localUri, {idempotent: true}).catch(
        () => undefined,
      );
      throw error;
    }
  }

  private downloadIfNeeded(page: number): Promise<string> {
    const pending = this.downloads.get(page);
    if (pending) return pending;
    const task = this.download(page).finally(() => this.downloads.delete(page));
    this.downloads.set(page, task);
    return task;
  }

  private async download(page: number): Promise<string> {
    const localUri = `${LOCAL_DIR}p${page}-v4.ttf`;

    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists && info.size && info.size > 0) return localUri;

    await this.ensureLocalDir();

    const temporaryUri = `${localUri}.download`;
    try {
      const result = await FileSystem.downloadAsync(
        `${REMOTE_BASE}/p${page}.ttf`,
        temporaryUri,
      );
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

  // Frees the space of the 1421H glyph fonts earlier releases downloaded.
  private sweepLegacyFonts(): void {
    if (this.legacySwept) return;
    this.legacySwept = true;
    (async () => {
      const files = await FileSystem.readDirectoryAsync(LOCAL_DIR);
      for (const name of files ?? []) {
        if (LEGACY_FILE.test(name)) {
          await FileSystem.deleteAsync(`${LOCAL_DIR}${name}`, {
            idempotent: true,
          });
        }
      }
    })().catch(() => undefined);
  }
}

export const qcfFontLoader = new QCFFontLoader();
// @ai-end
