// @ai-start
import {withQCFDarkPalette} from '../QCFColorPalette';

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
// @ai-end
