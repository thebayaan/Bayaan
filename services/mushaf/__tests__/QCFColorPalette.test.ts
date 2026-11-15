// @ai-start
import * as fs from 'fs';
import * as path from 'path';
import {
  withQCFDarkPalette,
  withQCFPalette,
  withoutQCFColor,
} from '../QCFColorPalette';

// Small SFNT fixture with head, CPAL and an unrelated glyph table.
function fontFixture(): Uint8Array {
  const bytes = new Uint8Array(132);
  const v = new DataView(bytes.buffer);
  v.setUint32(0, 0x00010000);
  v.setUint16(4, 3);
  const table = (record: number, tag: string, offset: number, size: number) => {
    [...tag].forEach((c, i) => v.setUint8(record + i, c.charCodeAt(0)));
    v.setUint32(record + 8, offset);
    v.setUint32(record + 12, size);
  };
  table(12, 'head', 60, 12);
  table(28, 'CPAL', 72, 32);
  table(44, 'glyf', 104, 28);
  v.setUint16(74, 2); // entries per palette
  v.setUint16(76, 2); // palettes
  v.setUint16(78, 4); // total colors
  v.setUint32(80, 16); // color array offset
  v.setUint16(84, 0); // day starts at color 0
  v.setUint16(86, 2); // night starts at color 2
  bytes.set([0, 0, 0, 255, 0, 0, 181, 255], 88);
  bytes.set([255, 255, 255, 255, 0, 0, 227, 255], 96);
  bytes.fill(0x42, 104);
  return bytes;
}

describe('QCF night palette', () => {
  it('selects the published night colors without changing glyphs or the source', () => {
    const source = fontFixture();
    const original = source.slice();
    const result = withQCFDarkPalette(source);
    const v = new DataView(result.buffer);
    expect(v.getUint16(84)).toBe(2);
    expect(result.slice(88)).toEqual(original.slice(88));
    expect(source).toEqual(original);
    let sum = 0;
    for (let i = 0; i < result.length; i += 4) {
      sum = (sum + v.getUint32(i)) % 0x100000000;
    }
    expect(sum).toBe(0xb1b0afba);
  });

  it('rejects a font without a usable night palette', () => {
    const source = fontFixture();
    new DataView(source.buffer).setUint16(76, 1);
    expect(() => withQCFDarkPalette(source)).toThrow('invalid color palette');
  });

  it('rejects truncated and out-of-bounds font tables', () => {
    expect(() => withQCFDarkPalette(new Uint8Array(10))).toThrow();
    const source = fontFixture();
    new DataView(source.buffer).setUint32(36, 1000);
    expect(() => withQCFDarkPalette(source)).toThrow('invalid color palette');
  });
});

// A real Mushaf 1440 page font (the file the app downloads for page 414).
const realFont = (): Uint8Array =>
  new Uint8Array(
    fs.readFileSync(
      path.join(process.cwd(), 'data/mushaf/legacy/QPCTajweed/p414.ttf'),
    ),
  );

function tables(bytes: Uint8Array): Array<{tag: string; offset: number}> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = [];
  for (let i = 0; i < v.getUint16(4); i++) {
    const record = 12 + i * 16;
    out.push({
      tag: String.fromCharCode(...bytes.slice(record, record + 4)),
      offset: v.getUint32(record + 8),
    });
  }
  return out;
}

function fileChecksum(bytes: Uint8Array): number {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let sum = 0;
  for (let i = 0; i + 4 <= bytes.length; i += 4) {
    sum = (sum + v.getUint32(i)) % 0x100000000;
  }
  const rest = bytes.length % 4;
  if (rest) {
    let word = 0;
    for (let j = 0; j < 4; j++) {
      const index = bytes.length - rest + j;
      word = word * 256 + (j < rest ? bytes[index] : 0);
    }
    sum = (sum + word) % 0x100000000;
  }
  return sum;
}

describe('Mushaf 1440 font variants (real page font)', () => {
  it('selects any published palette', () => {
    const source = realFont();
    const result = withQCFPalette(source, 3);
    const cpal = tables(result).find(t => t.tag === 'CPAL')!.offset;
    const v = new DataView(result.buffer);
    expect(v.getUint16(cpal + 12)).toBe(v.getUint16(cpal + 12 + 3 * 2));
    expect(fileChecksum(result)).toBe(0xb1b0afba);
    expect(() => withQCFPalette(source, 6)).toThrow('invalid color palette');
  });

  it('hides the colour tables so the plain outlines draw', () => {
    const source = realFont();
    const original = source.slice();
    const result = withoutQCFColor(source);
    const tags = tables(result).map(t => t.tag);
    expect(tags).not.toContain('COLR');
    expect(tags).not.toContain('CPAL');
    expect(tags).toContain('COLX');
    expect(tags).toContain('CPAX');
    // The directory stays sorted, so binary-searching parsers still work.
    expect([...tags].sort()).toEqual(tags);
    expect(fileChecksum(result)).toBe(0xb1b0afba);
    // Glyph data is untouched, and so is the downloaded copy.
    const glyf = tables(result).find(t => t.tag === 'glyf')!.offset;
    expect(
      Buffer.compare(
        Buffer.from(result.subarray(glyf)),
        Buffer.from(original.subarray(glyf)),
      ),
    ).toBe(0);
    expect(Buffer.compare(Buffer.from(source), Buffer.from(original))).toBe(0);
  });

  it('refuses a font without colour tables', () => {
    expect(() => withoutQCFColor(withoutQCFColor(realFont()))).toThrow();
  });
});
// @ai-end
