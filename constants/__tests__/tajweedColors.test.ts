// @ai-generated
// Release 1 rewayah highlights are whole-word variants and silah only: the
// retired letter-level categories have no color, so no renderer can draw
// them (every renderer looks colors up here by rule name). Hafs tajweed
// colors are unchanged.
import * as fs from 'fs';
import * as path from 'path';
import {REWAYAH_DIFF_BACKGROUND, tajweedColors} from '../tajweedColors';

// The Hafs palette as it was before the letter-level categories were retired.
const HAFS_COLORS: Record<string, string> = {
  madda_necessary: '#BF0100',
  madda_obligatory_mottasel: '#FF3EAE',
  madda_obligatory_monfasel: '#FF3EAE',
  madda_permissible: '#F47215',
  madda_normal: '#C38A07',
  'custom-alef-maksora': '#C38A07',
  ghunnah: '#0CBF71',
  idgham_ghunnah: '#0CBF71',
  idgham_shafawi: '#0CBF71',
  ikhafa: '#0CBF71',
  ikhafa_shafawi: '#0CBF71',
  iqlab: '#0CBF71',
  qalaqah: '#57CFFF',
  tafkhim: '#0088C7',
  idgham_mutajanisayn: '#0088C7',
  idgham_mutaqaribayn: '#0088C7',
  idgham_wo_ghunnah: '#0088C7',
  slnt: '#AAAAAA',
  ham_wasl: '#AAAAAA',
  laam_shamsiyah: '#AAAAAA',
};

describe('tajweedColors', () => {
  it('has no color for the retired letter-level rewayah categories', () => {
    for (const retired of ['tashil', 'madd', 'ibdal', 'taghliz', 'minor']) {
      expect(tajweedColors[retired]).toBeUndefined();
    }
  });

  it('keeps the Release 1 rewayah colors', () => {
    expect(tajweedColors.silah).toBe('#8A4FFF');
    expect(REWAYAH_DIFF_BACKGROUND).toBe('rgba(255, 107, 53, 0.3)');
  });

  it('keeps every Hafs tajweed color as it was, and nothing else', () => {
    expect(tajweedColors).toEqual({...HAFS_COLORS, silah: '#8A4FFF'});
  });

  it('colors every rule the bundled Hafs tajweed data uses', () => {
    const raw = fs.readFileSync(
      path.join(__dirname, '../../data/QPC Hafs Tajweed 2.json'),
      'utf8',
    );
    const rules = new Set(
      [...raw.matchAll(/<rule class=\\?"?([a-z_-]+)/g)].map(m => m[1]),
    );
    expect(rules.size).toBeGreaterThan(10);
    for (const rule of rules) {
      expect([rule, tajweedColors[rule]]).toEqual([rule, HAFS_COLORS[rule]]);
    }
  });
});
