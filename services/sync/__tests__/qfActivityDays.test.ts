import {
  addReading,
  expandRanges,
  isExpiredBatch,
  localDateOf,
  mergeVerseKeys,
  parseBatches,
  type QfActivityBatch,
} from '../qfActivityDays';

function batch(extra: Partial<QfActivityBatch> = {}): QfActivityBatch {
  return {
    id: 'batch-1',
    date: '2026-10-12',
    timezone: 'America/Los_Angeles',
    seconds: 30,
    ranges: ['1:1-1:7'],
    sealed: false,
    ...extra,
  };
}

describe('mergeVerseKeys', () => {
  it('merges consecutive verses and splits at gaps and surah boundaries', () => {
    expect(
      mergeVerseKeys(['2:3', '1:7', '2:1', '2:2', '1:6', '2:5', '2:2']),
    ).toEqual(['1:6-1:7', '2:1-2:3', '2:5-2:5']);
  });

  it('drops keys that are not real verses', () => {
    expect(mergeVerseKeys(['1:8', '115:1', '2:0', 'x', '2:255:7'])).toEqual([]);
  });

  it('round-trips through expandRanges', () => {
    const ranges = ['2:250-2:257', '3:1-3:2'];
    expect(mergeVerseKeys(expandRanges(ranges))).toEqual(ranges);
  });
});

describe('addReading', () => {
  const reading = {
    date: '2026-10-12',
    timezone: 'America/Los_Angeles',
    seconds: 20,
    verseKeys: ['1:7', '2:1', '2:2'],
    newId: () => 'batch-2',
  };

  it('adds to the open batch for the same day', () => {
    expect(addReading([batch()], reading)).toEqual([
      batch({seconds: 50, ranges: ['1:1-1:7', '2:1-2:2']}),
    ]);
  });

  it('starts a new batch once the open one was sent', () => {
    const sealed = batch({sealed: true});
    expect(addReading([sealed], reading)).toEqual([
      sealed,
      batch({id: 'batch-2', seconds: 20, ranges: ['1:7-1:7', '2:1-2:2']}),
    ]);
  });

  it('starts a new batch on a new day', () => {
    const next = addReading([batch()], {...reading, date: '2026-10-13'});
    expect(next.map(queued => queued.date)).toEqual([
      '2026-10-12',
      '2026-10-13',
    ]);
  });

  it('caps a day at 24 hours', () => {
    const [only] = addReading([batch({seconds: 86_390})], reading);
    expect(only.seconds).toBe(86_400);
  });

  it('ignores reading with no valid verses', () => {
    expect(addReading([], {...reading, verseKeys: ['999:1']})).toEqual([]);
  });
});

describe('dates and storage', () => {
  it('uses the device calendar date', () => {
    expect(localDateOf(new Date(2026, 0, 5, 23, 59).getTime())).toBe(
      '2026-01-05',
    );
  });

  it('expires batches older than six days', () => {
    const now = new Date(2026, 9, 12, 12).getTime();
    expect(isExpiredBatch(batch({date: '2026-10-06'}), now)).toBe(false);
    expect(isExpiredBatch(batch({date: '2026-10-05'}), now)).toBe(true);
  });

  it('reads back only well-formed batches', () => {
    expect(
      parseBatches(JSON.stringify([batch(), {id: 'broken'}, 'nope'])),
    ).toEqual([batch()]);
    expect(parseBatches('not json')).toEqual([]);
    expect(parseBatches(undefined)).toEqual([]);
  });
});
