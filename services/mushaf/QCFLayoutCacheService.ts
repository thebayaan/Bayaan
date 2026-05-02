import {createMMKV, type MMKV} from 'react-native-mmkv';

const SCHEMA_VERSION = 1;

export interface QCFPageLayoutMetrics {
  fontSize: number;
  lineWidthsAtRef: Array<{
    lineIndex: number;
    width: number;
  }>;
}

function mmkvKey(fontFamily: string, pageNumber: number): string {
  return `qcf:${fontFamily}:${pageNumber}`;
}

class QCFLayoutCacheService {
  private mmkv: MMKV;

  constructor() {
    this.mmkv = createMMKV({id: 'qcf-layouts'});

    const storedVersion = this.mmkv.getNumber('qcf_schema_version');
    if (storedVersion !== SCHEMA_VERSION) {
      this.mmkv.clearAll();
      this.mmkv.set('qcf_schema_version', SCHEMA_VERSION);
    }
  }

  getPageLayout(
    pageNumber: number,
    fontFamily: string,
  ): QCFPageLayoutMetrics | undefined {
    const json = this.mmkv.getString(mmkvKey(fontFamily, pageNumber));
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
      return parsed;
    } catch {
      return undefined;
    }
  }

  setPageLayout(
    pageNumber: number,
    fontFamily: string,
    data: QCFPageLayoutMetrics,
  ): void {
    this.mmkv.set(mmkvKey(fontFamily, pageNumber), JSON.stringify(data));
  }

  clearAll(): void {
    this.mmkv.clearAll();
    this.mmkv.set('qcf_schema_version', SCHEMA_VERSION);
  }
}

export const qcfLayoutCacheService = new QCFLayoutCacheService();
