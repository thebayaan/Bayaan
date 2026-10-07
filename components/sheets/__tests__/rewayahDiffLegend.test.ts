// @ai-generated
// The "Show Differences" legend lists only what the bundled data carries,
// and only the Release 1 categories (whole-word variant, silah).
import {
  buildRewayahLegend,
  getDiffLegendCategories,
  getRewayahDiffLegend,
} from '../rewayahDiffLegend';
import type {RewayahWithDiffs} from '@/services/rewayah/RewayahIdentity';

const REWAYAT: RewayahWithDiffs[] = [
  'shubah',
  'al-bazzi',
  'qunbul',
  'warsh',
  'qalun',
  'al-duri-abi-amr',
  'al-susi',
];
const RELEASE_1_LABELS = ['Word variant', 'Silah'];
const RETIRED = /tashil|musahhala|madd|ibdal|taghliz|vowel|mood/i;

describe('getDiffLegendCategories', () => {
  it('reads Release 1 files and skips the __format key', () => {
    expect(
      getDiffLegendCategories(
        {
          __format: 2,
          '2:2': {major: [[5, []]], silah: [[5, [6, 7]]]},
        },
        false,
      ),
    ).toEqual({wordVariants: true, silah: true, silahDiffersFromHafs: true});
    expect(
      getDiffLegendCategories(
        {__format: 2, '1:4': {mukhtalif: [[1, []]]}},
        true,
      ),
    ).toEqual({wordVariants: true, silah: false, silahDiffersFromHafs: true});
  });

  it('ignores empty category lists', () => {
    expect(
      getDiffLegendCategories(
        {__format: 2, '1:1': {major: [], silah: []}},
        false,
      ),
    ).toEqual({wordVariants: false, silah: false, silahDiffersFromHafs: true});
  });

  it('reads legacy files: flat lists, two-tier lists and letter-level only', () => {
    expect(getDiffLegendCategories({'1:4': [1]}, false).wordVariants).toBe(
      true,
    );
    expect(
      getDiffLegendCategories({'2:6': {major: [6], minor: [2]}}, true),
    ).toEqual({wordVariants: true, silah: true, silahDiffersFromHafs: false});
    expect(
      getDiffLegendCategories({'1:2': {tashil: [[1, [0]]]}}, false)
        .wordVariants,
    ).toBe(false);
  });

  it('tolerates malformed input', () => {
    expect(getDiffLegendCategories(null, false)).toEqual({
      wordVariants: false,
      silah: false,
      silahDiffersFromHafs: false,
    });
  });
});

describe('buildRewayahLegend', () => {
  it('never lists the retired letter-level categories', () => {
    const legend = buildRewayahLegend({
      wordVariants: true,
      silah: true,
      silahDiffersFromHafs: true,
    });
    expect(legend.entries.map(e => e.label)).toEqual(RELEASE_1_LABELS);
    for (const entry of legend.entries) {
      expect(entry.label).not.toMatch(RETIRED);
    }
  });

  it('omits silah when the data has none', () => {
    const legend = buildRewayahLegend({
      wordVariants: true,
      silah: false,
      silahDiffersFromHafs: true,
    });
    expect(legend.entries.map(e => e.label)).toEqual(['Word variant']);
    expect(legend.summary).not.toMatch(/silah/i);
  });
});

describe('getRewayahDiffLegend (bundled data)', () => {
  it.each(REWAYAT)('%s lists only Release 1 entries', rewayah => {
    const legend = getRewayahDiffLegend(rewayah);
    expect(legend.entries.length).toBeGreaterThan(0);
    for (const entry of legend.entries) {
      expect(RELEASE_1_LABELS).toContain(entry.label);
    }
  });

  it('uses no em dashes in user-facing copy', () => {
    for (const rewayah of REWAYAT) {
      const legend = getRewayahDiffLegend(rewayah);
      const copy = [
        legend.summary,
        ...legend.entries.flatMap(e => [e.label, e.description]),
      ].join(' ');
      expect(copy).not.toMatch(/\u2014/);
    }
  });
});
