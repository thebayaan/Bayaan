// @ai-start
// In-memory variants of a Mushaf 1440 (QCF V4) page font. The downloaded
// file is never changed; each variant is a rewritten copy of its bytes.
//
//  - Palettes: Skia's JS typeface API doesn't expose OpenType palette
//    selection, so a palette is chosen by making it the font's default one
//    (CPAL colorRecordIndices[0] points at its colours). The V4 fonts publish
//    a day (0) and a night (1) tajweed palette.
//  - Plain: every V4 word glyph also carries its whole outline as a plain
//    glyph. Hiding the colour tables (COLR, CPAL) makes the font draw those
//    outlines in the text colour, like any monochrome font, so the reading
//    theme's colour and per-word colours (mistakes, highlights) apply.

const TAG_CPAL = 0x4350414c;
const TAG_COLR = 0x434f4c52;
const TAG_HEAD = 0x68656164;
// Unregistered tags that keep the table directory sorted ('COLR' < 'COLX' <
// 'CPAL' < 'CPAX' < every tag after them).
const TAG_COLR_HIDDEN = 0x434f4c58;
const TAG_CPAL_HIDDEN = 0x43504158;

/** Index of the night tajweed palette in the V4 fonts. */
export const QCF_NIGHT_PALETTE = 1;

interface TableRecord {
  record: number;
  tag: number;
  offset: number;
  length: number;
}

function invalid(): Error {
  return new Error('QCF tajweed font has an invalid color palette');
}

function readTables(bytes: Uint8Array): {
  view: DataView;
  tables: TableRecord[];
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 12 || view.getUint32(0) !== 0x00010000) throw invalid();
  const numTables = view.getUint16(4);
  if (12 + numTables * 16 > bytes.length) throw invalid();
  const tables: TableRecord[] = [];
  for (let i = 0; i < numTables; i++) {
    const record = 12 + i * 16;
    const offset = view.getUint32(record + 8);
    const length = view.getUint32(record + 12);
    if (offset + length > bytes.length) throw invalid();
    tables.push({record, tag: view.getUint32(record), offset, length});
  }
  return {view, tables};
}

function checksum(bytes: Uint8Array, start: number, size: number): number {
  let sum = 0;
  for (let i = 0; i < size; i += 4) {
    let word = 0;
    for (let j = 0; j < 4; j++) {
      word = word * 256 + (i + j < size ? bytes[start + i + j] : 0);
    }
    sum = (sum + word) % 0x100000000;
  }
  return sum;
}

/** Recomputes head.checkSumAdjustment after the file changed. */
function fixFileChecksum(
  bytes: Uint8Array,
  view: DataView,
  head: TableRecord,
): void {
  view.setUint32(head.offset + 8, 0);
  view.setUint32(
    head.offset + 8,
    (0xb1b0afba - checksum(bytes, 0, bytes.length) + 0x100000000) % 0x100000000,
  );
}

/** A copy of the font whose default palette is palette `index`. */
export function withQCFPalette(source: Uint8Array, index: number): Uint8Array {
  const bytes = new Uint8Array(source);
  const {view, tables} = readTables(bytes);
  const cpal = tables.find(t => t.tag === TAG_CPAL);
  const head = tables.find(t => t.tag === TAG_HEAD && t.length >= 12);
  if (!cpal || !head || cpal.length < 16) throw invalid();

  const {offset, length, record} = cpal;
  const entries = view.getUint16(offset + 2);
  const palettes = view.getUint16(offset + 4);
  const records = view.getUint16(offset + 6);
  const colorsOffset = view.getUint32(offset + 8);
  if (
    view.getUint16(offset) > 1 ||
    index < 0 ||
    palettes <= index ||
    entries === 0 ||
    12 + palettes * 2 > length ||
    colorsOffset < 12 + palettes * 2 ||
    colorsOffset + records * 4 > length
  ) {
    throw invalid();
  }
  const start = view.getUint16(offset + 12 + index * 2);
  if (start + entries > records) throw invalid();

  // colorRecordIndices[0] now references palette `index`.
  view.setUint16(offset + 12, start);
  view.setUint32(record + 4, checksum(bytes, offset, length));
  fixFileChecksum(bytes, view, head);
  return bytes;
}

/** A copy of the font that draws its night tajweed palette. */
export function withQCFDarkPalette(source: Uint8Array): Uint8Array {
  return withQCFPalette(source, QCF_NIGHT_PALETTE);
}

/**
 * A copy of the font with its colour tables hidden: every glyph draws its
 * plain outline in the text colour.
 */
export function withoutQCFColor(source: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(source);
  const {view, tables} = readTables(bytes);
  const head = tables.find(t => t.tag === TAG_HEAD && t.length >= 12);
  const colr = tables.find(t => t.tag === TAG_COLR);
  if (!head || !colr) throw invalid();
  view.setUint32(colr.record, TAG_COLR_HIDDEN);
  const cpal = tables.find(t => t.tag === TAG_CPAL);
  if (cpal) view.setUint32(cpal.record, TAG_CPAL_HIDDEN);
  fixFileChecksum(bytes, view, head);
  return bytes;
}
// @ai-end
