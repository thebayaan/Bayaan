// @ai-start
// Skia's JS typeface API doesn't expose OpenType palette selection. Make
// the font's existing night palette its default before registering it.
// Glyph outlines and the downloaded file stay unchanged.
export function withQCFDarkPalette(source: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(source);
  const view = new DataView(bytes.buffer);
  const invalid = () =>
    new Error('QCF tajweed font has an invalid color palette');
  if (bytes.length < 12 || view.getUint32(0) !== 0x00010000) throw invalid();

  const numTables = view.getUint16(4);
  if (12 + numTables * 16 > bytes.length) throw invalid();
  let cpal: {record: number; offset: number; length: number} | undefined;
  let head: number | undefined;
  for (let i = 0; i < numTables; i++) {
    const record = 12 + i * 16;
    const tag = view.getUint32(record);
    const offset = view.getUint32(record + 8);
    const length = view.getUint32(record + 12);
    if (offset + length > bytes.length) throw invalid();
    if (tag === 0x4350414c) cpal = {record, offset, length}; // CPAL
    if (tag === 0x68656164 && length >= 12) head = offset; // head
  }
  if (!cpal || head == null || cpal.length < 16) throw invalid();

  const {offset, length, record} = cpal;
  const entries = view.getUint16(offset + 2);
  const palettes = view.getUint16(offset + 4);
  const records = view.getUint16(offset + 6);
  const colorsOffset = view.getUint32(offset + 8);
  const nightStart = view.getUint16(offset + 14);
  if (
    view.getUint16(offset) > 1 ||
    palettes < 2 ||
    entries === 0 ||
    12 + palettes * 2 > length ||
    colorsOffset < 12 + palettes * 2 ||
    colorsOffset + records * 4 > length ||
    nightStart + entries > records
  ) {
    throw invalid();
  }

  // CPAL colorRecordIndices[0] now references the original palette 1.
  view.setUint16(offset + 12, nightStart);
  const checksum = (start: number, size: number): number => {
    let sum = 0;
    for (let i = 0; i < size; i += 4) {
      let word = 0;
      for (let j = 0; j < 4; j++) {
        word = word * 256 + (i + j < size ? bytes[start + i + j] : 0);
      }
      sum = (sum + word) % 0x100000000;
    }
    return sum;
  };
  view.setUint32(record + 4, checksum(offset, length));
  view.setUint32(head + 8, 0);
  view.setUint32(head + 8, 0xb1b0afba - checksum(0, bytes.length));
  return bytes;
}
// @ai-end
