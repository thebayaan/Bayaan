import {
  ALL_REWAYAH_IDS,
  hasDiffData,
  hasTextData,
  type RewayahId,
} from '../RewayahIdentity';

// The 7 non-Hafs rewayat whose mushaf text is built by applying diffs to the
// Hafs baseline. These are the ones the Mushaf-settings UI marks Experimental
// (see RewayahAccordion in components/MushafSettingsContent.tsx).
//
// This list is duplicated here on purpose: the test is the tripwire. If a
// rewayah gains or loses bundled diff data, the badge set changes with it and
// this test must be updated deliberately rather than silently drifting.
const EXPERIMENTAL_IDS: readonly RewayahId[] = [
  'shubah',
  'al-bazzi',
  'qunbul',
  'warsh',
  'qalun',
  'al-duri-abi-amr',
  'al-susi',
];

describe('hasDiffData (Experimental-badge predicate)', () => {
  it('flags exactly the 7 non-Hafs rewayat with bundled diff data', () => {
    const flagged = ALL_REWAYAH_IDS.filter(hasDiffData);
    expect(flagged).toHaveLength(7);
    expect([...flagged].sort()).toEqual([...EXPERIMENTAL_IDS].sort());
  });

  it('never flags Hafs, which is the verified baseline', () => {
    expect(hasDiffData('hafs')).toBe(false);
  });

  it('never flags a rewayah that has no bundled text at all', () => {
    const audioOnly = ALL_REWAYAH_IDS.filter(id => !hasTextData(id));

    expect(audioOnly).toHaveLength(12);
    for (const id of audioOnly) {
      expect(hasDiffData(id)).toBe(false);
    }
  });

  it('only flags rewayat that also have renderable text', () => {
    // Invariant: you cannot diff text you cannot render. A rewayah with diff
    // data but no text data would badge a row the picker also disables.
    for (const id of ALL_REWAYAH_IDS) {
      if (hasDiffData(id)) {
        expect(hasTextData(id)).toBe(true);
      }
    }
  });
});
