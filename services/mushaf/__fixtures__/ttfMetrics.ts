// @ai-generated
/**
 * Test-only TrueType metrics reader: glyph ids (cmap formats 4 and 12) and
 * advance widths (hmtx) of a font file, so layout tests can measure the real
 * Mushaf 1440 page fonts without Skia. Not imported by app code.
 */
import * as fs from 'fs';

export interface TtfMetrics {
  unitsPerEm: number;
  glyphId(codePoint: number): number;
  advance(glyphId: number): number;
  /** Advance of each code point of `text`, in em. */
  advancesEm(text: string): number[];
}

export function readTtfMetrics(file: string): TtfMetrics {
  const bytes = fs.readFileSync(file);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tables = new Map<string, number>();
  for (let i = 0; i < v.getUint16(4); i++) {
    const record = 12 + i * 16;
    tables.set(
      bytes.toString('latin1', record, record + 4),
      v.getUint32(record + 8),
    );
  }
  const table = (tag: string): number => {
    const offset = tables.get(tag);
    if (offset === undefined) throw new Error(`${file}: no ${tag} table`);
    return offset;
  };
  const head = table('head');
  const hhea = table('hhea');
  const hmtx = table('hmtx');
  const cmap = table('cmap');
  const unitsPerEm = v.getUint16(head + 18);
  const numberOfHMetrics = v.getUint16(hhea + 34);

  // Prefer a full-repertoire subtable (format 12), else a BMP one (format 4).
  let format4: number | null = null;
  let format12: number | null = null;
  for (let i = 0; i < v.getUint16(cmap + 2); i++) {
    const offset = cmap + v.getUint32(cmap + 4 + i * 8 + 4);
    const format = v.getUint16(offset);
    if (format === 12) format12 = offset;
    else if (format === 4) format4 = offset;
  }

  const glyphId = (codePoint: number): number => {
    if (format12 !== null) {
      const groups = v.getUint32(format12 + 12);
      for (let g = 0; g < groups; g++) {
        const at = format12 + 16 + g * 12;
        const start = v.getUint32(at);
        const end = v.getUint32(at + 4);
        if (codePoint >= start && codePoint <= end) {
          return v.getUint32(at + 8) + (codePoint - start);
        }
      }
      return 0;
    }
    if (format4 === null) return 0;
    const segX2 = v.getUint16(format4 + 6);
    const ends = format4 + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const ranges = deltas + segX2;
    for (let s = 0; s < segX2 / 2; s++) {
      const end = v.getUint16(ends + s * 2);
      if (codePoint > end) continue;
      const start = v.getUint16(starts + s * 2);
      if (codePoint < start) return 0;
      const delta = v.getInt16(deltas + s * 2);
      const rangeOffset = v.getUint16(ranges + s * 2);
      // Glyph ids wrap modulo 65536 (format 4 deltas are 16-bit).
      if (rangeOffset === 0) return (codePoint + delta + 65536) % 65536;
      const at = ranges + s * 2 + rangeOffset + (codePoint - start) * 2;
      const id = v.getUint16(at);
      return id === 0 ? 0 : (id + delta + 65536) % 65536;
    }
    return 0;
  };

  const advance = (id: number): number =>
    v.getUint16(hmtx + Math.min(id, numberOfHMetrics - 1) * 4);

  return {
    unitsPerEm,
    glyphId,
    advance,
    advancesEm: text =>
      [...text].map(
        char => advance(glyphId(char.codePointAt(0) ?? 0)) / unitsPerEm,
      ),
  };
}
