// @ai-start
import type {MMKV} from 'react-native-mmkv';
import {openVersionedMMKV} from '@/utils/versionedMMKV';

const SCHEMA_VERSION = 2;

export interface QCFPageLayoutMetrics {
  fontSize: number;
  lineWidthsAtRef: Array<{
    lineIndex: number;
    width: number;
  }>;
}

function mmkvKey(
  fontFamily: string,
  pageNumber: number,
  contentWidth: number,
): string {
  return `qcf:${fontFamily}:${pageNumber}:${contentWidth}`;
}

class QCFLayoutCacheService {
  private mmkv: MMKV;
  private memCache = new Map<string, QCFPageLayoutMetrics>();

  constructor() {
    this.mmkv = openVersionedMMKV({
      id: 'qcf-layouts',
      versionKey: 'qcf_schema_version',
      version: SCHEMA_VERSION,
    }).mmkv;
  }

  getPageLayout(
    pageNumber: number,
    fontFamily: string,
    contentWidth: number,
  ): QCFPageLayoutMetrics | undefined {
    const key = mmkvKey(fontFamily, pageNumber, contentWidth);
    const memHit = this.memCache.get(key);
    if (memHit) return memHit;

    const json = this.mmkv.getString(key);
    if (!json) return undefined;

    try {
      const parsed = JSON.parse(json) as QCFPageLayoutMetrics;
      if (
        !parsed ||
        typeof parsed.fontSize !== 'number' ||
        !Array.isArray(parsed.lineWidthsAtRef) ||
        parsed.lineWidthsAtRef.length === 0
      ) {
        return undefined;
      }
      this.memCache.set(key, parsed);
      return parsed;
    } catch {
      return undefined;
    }
  }

  setPageLayout(
    pageNumber: number,
    fontFamily: string,
    contentWidth: number,
    data: QCFPageLayoutMetrics,
  ): void {
    const key = mmkvKey(fontFamily, pageNumber, contentWidth);
    this.memCache.set(key, data);
    this.mmkv.set(key, JSON.stringify(data));
  }

  clearAll(): void {
    this.memCache.clear();
    this.mmkv.clearAll();
    this.mmkv.set('qcf_schema_version', SCHEMA_VERSION);
  }
}

export const qcfLayoutCacheService = new QCFLayoutCacheService();
// @ai-end
