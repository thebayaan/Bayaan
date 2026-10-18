import type {AyahTimestamp} from '@/types/timestamps';
import type {WidgetNowPlaying} from 'bayaan-widgets';
import {KAHF_TRACK} from '@/test-utils/widgetSnapshots';
import {rewayahVerseMapService} from '@/services/mushaf/RewayahVerseMapService';
import {loadTimings} from '@/services/timestamps/__fixtures__/timingFixtures';
import {
  createTimingNumbering,
  type TimingNumberingMode,
} from '@/utils/timestampNumbering';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {
  buildActivityAyah,
  currentAyahTimestamp,
  hafsActivityAyah,
  msUntilNextAyah,
  positionAt,
  truncateUtf8Words,
  utf8Length,
} from '../ayahLayer';

const TS: AyahTimestamp[] = [
  {
    surahNumber: 18,
    ayahNumber: 1,
    timestampFrom: 5000,
    timestampTo: 12000,
    durationMs: 7000,
  },
  {
    surahNumber: 18,
    ayahNumber: 2,
    timestampFrom: 12000,
    timestampTo: 20000,
    durationMs: 8000,
  },
  {
    surahNumber: 18,
    ayahNumber: 3,
    timestampFrom: 20000,
    timestampTo: 26000,
    durationMs: 6000,
  },
];

const NP: WidgetNowPlaying = {
  track: KAHF_TRACK,
  isPlaying: true,
  positionSec: 100,
  durationSec: 1800,
  rate: 1.5,
};

describe('current and next ayah', () => {
  it('finds the ayah at a position, null before the first', () => {
    expect(currentAyahTimestamp(TS, 4)).toBe(null);
    expect(currentAyahTimestamp(TS, 12)?.ayahNumber).toBe(2);
    expect(currentAyahTimestamp(TS, 30)?.ayahNumber).toBe(3);
  });

  it('measures wall time to the next boundary at the playback rate', () => {
    expect(msUntilNextAyah(TS, 0, 1)).toBe(5000);
    expect(msUntilNextAyah(TS, 10, 1)).toBe(2000);
    expect(msUntilNextAyah(TS, 10, 2)).toBe(1000);
    expect(msUntilNextAyah(TS, 10, 0)).toBe(2000);
    expect(msUntilNextAyah(TS, 21, 1)).toBe(null);
  });
});

describe('positionAt', () => {
  it('extrapolates while playing, at the rate, clamped', () => {
    expect(positionAt(NP, 1_000_000, 1_010_000)).toBe(115);
    expect(positionAt({...NP, isPlaying: false}, 1_000_000, 1_010_000)).toBe(
      100,
    );
    expect(positionAt(NP, 1_000_000, 9_000_000)).toBe(1800);
  });
});

describe('UTF-8 truncation', () => {
  it('counts bytes per code point', () => {
    expect(utf8Length('abc')).toBe(3);
    expect(utf8Length('ب')).toBe(2);
    expect(utf8Length('ﷺ')).toBe(3);
    expect(utf8Length('😀')).toBe(4);
  });

  it('keeps short text and cuts long text at a word with an ellipsis', () => {
    expect(truncateUtf8Words('aaaa bbbb', 20)).toBe('aaaa bbbb');
    expect(truncateUtf8Words('aaaa bbbb cccc', 12)).toBe('aaaa …');
    expect(
      utf8Length(truncateUtf8Words('بببب '.repeat(200), 600)),
    ).toBeLessThanOrEqual(600);
  });

  it('cuts a single oversized word by bytes with no leading space', () => {
    const out = truncateUtf8Words('😀'.repeat(10), 10);
    expect(out).toBe('😀…');
    expect(utf8Length(out)).toBeLessThanOrEqual(10);
    expect(truncateUtf8Words('abcdefghijkl mm', 8)).toBe('abcde…');
  });

  it('builds the activity ayah', () => {
    expect(buildActivityAyah(2, 3, 'text')).toEqual({
      number: 2,
      count: 3,
      text: 'text',
    });
  });
});

describe('hafsActivityAyah', () => {
  function fixture(
    mode: TimingNumberingMode,
    rewayah: RewayahId,
    set: string,
    surah: number,
  ) {
    const entries = loadTimings(set, surah);
    if (!entries) throw new Error(`missing fixture ${set}/${surah}`);
    const numbering = createTimingNumbering({
      surah,
      mode,
      reciterRewayah: rewayah,
      reason: 'test',
      entries,
      verseMap: rewayahVerseMapService,
    });
    return {entries, numbering};
  }
  const text = (key: string): string => `hafs ${key}`;

  it('shows the Hafs ayah a Warsh-numbered entry recites, not the entry number', () => {
    const {entries, numbering} = fixture('riwayah', 'warsh', 'warsh-14', 2);
    // Warsh 2:4 recites Hafs 2:5 (Warsh 2:1 holds Hafs 2:1-2).
    const entry = entries.find(e => e.ayahNumber === 4);
    if (!entry) throw new Error('missing Warsh entry 4');
    expect(hafsActivityAyah(numbering, entry, 286, text)).toEqual({
      number: 5,
      count: 286,
      text: 'hafs 2:5',
    });
  });

  it('shows the first Hafs ayah of an entry that recites two', () => {
    const {entries, numbering} = fixture('riwayah', 'warsh', 'warsh-14', 2);
    expect(hafsActivityAyah(numbering, entries[0], 286, text)).toEqual({
      number: 1,
      count: 286,
      text: 'hafs 2:1',
    });
  });

  it('keys the text by the surah, not the entry surahNumber', () => {
    const {numbering} = fixture('hafs', 'hafs', 'hafs-clean', 2);
    const entry = {...TS[1], surahNumber: 0, ayahNumber: 7};
    expect(hafsActivityAyah(numbering, entry, 286, text)).toEqual({
      number: 7,
      count: 286,
      text: 'hafs 2:7',
    });
  });

  it('hides the ayah line for a disabled numbering or a pre-roll entry', () => {
    const {entries, numbering} = fixture('disabled', 'warsh', 'warsh-14', 2);
    expect(hafsActivityAyah(numbering, entries[3], 286, text)).toBeNull();
    const hafs = fixture('hafs', 'hafs', 'hafs-clean', 2).numbering;
    expect(
      hafsActivityAyah(hafs, {...TS[0], ayahNumber: 0}, 286, text),
    ).toBeNull();
  });
});
