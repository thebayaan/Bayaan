// On-demand QCF V2 page-font loader. The full 604-font payload is ~200 MB
// (TTF), so bundling is impractical. Each font is downloaded once into the
// app's documentDirectory on first use of that page, then registered on
// the shared Skia TypefaceFontProvider. Subsequent requests for the same
// page resolve synchronously.
//
// Font family naming: `p{N}-v2`. SkiaPage / QCFPage refer to fonts by
// this name, the loader keeps the shared TypefaceFontProvider in sync.

import * as FileSystem from 'expo-file-system/legacy';
import {Skia, type SkTypefaceFontProvider} from '@shopify/react-native-skia';

const TOTAL_PAGES = 604;
const REMOTE_BASE =
  'https://raw.githubusercontent.com/nuqayah/qpc-fonts/master/mushaf-v2';
const LOCAL_DIR = `${FileSystem.documentDirectory}qcf-fonts/`;

export function qcfFontFamilyForPage(page: number): string {
  return `p${page}-v2`;
}

class QCFFontLoader {
  private registered = new Set<number>();
  private inFlight = new Map<number, Promise<void>>();
  private dirEnsured = false;

  isReady(page: number): boolean {
    return this.registered.has(page);
  }

  async ensure(page: number, fontMgr: SkTypefaceFontProvider): Promise<void> {
    if (page < 1 || page > TOTAL_PAGES) {
      throw new Error(`QCF font: page ${page} out of range`);
    }
    if (this.registered.has(page)) return;

    const inFlight = this.inFlight.get(page);
    if (inFlight) return inFlight;

    const task = this.loadAndRegister(page, fontMgr).finally(() => {
      this.inFlight.delete(page);
    });
    this.inFlight.set(page, task);
    return task;
  }

  // Best-effort prefetch for nearby pages. Errors are swallowed — the
  // primary ensure() call for the visible page is what matters.
  prefetch(pages: number[], fontMgr: SkTypefaceFontProvider): void {
    for (const p of pages) {
      if (p >= 1 && p <= TOTAL_PAGES && !this.registered.has(p)) {
        this.ensure(p, fontMgr).catch(() => {
          // Ignore — prefetch is opportunistic
        });
      }
    }
  }

  private async loadAndRegister(
    page: number,
    fontMgr: SkTypefaceFontProvider,
  ): Promise<void> {
    const localUri = await this.downloadIfNeeded(page);
    const data = await Skia.Data.fromURI(localUri);
    const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
    if (!typeface) {
      throw new Error(`QCF page ${page}: typeface creation returned null`);
    }
    fontMgr.registerFont(typeface, qcfFontFamilyForPage(page));
    this.registered.add(page);
  }

  private async downloadIfNeeded(page: number): Promise<string> {
    const filename = `QCF2${page.toString().padStart(3, '0')}.ttf`;
    const localUri = `${LOCAL_DIR}${filename}`;

    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists && info.size && info.size > 0) return localUri;

    await this.ensureLocalDir();

    const remoteUri = `${REMOTE_BASE}/${filename}`;
    const result = await FileSystem.downloadAsync(remoteUri, localUri);
    if (result.status !== 200) {
      // Clean up partial download
      try {
        await FileSystem.deleteAsync(localUri, {idempotent: true});
      } catch {
        // ignore cleanup errors
      }
      throw new Error(`QCF page ${page}: download HTTP ${result.status}`);
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
