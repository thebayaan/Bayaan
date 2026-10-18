// modules/bayaan-widgets/src/__tests__/widgetKinds.test.ts
import full from '../__fixtures__/snapshot.full.json';
import {changedWidgetKinds} from '../widgetKinds';
import {isWidgetSnapshot, WidgetSnapshot} from '../snapshot';

function base(): WidgetSnapshot {
  if (!isWidgetSnapshot(full)) throw new Error('fixture invalid');
  return structuredClone(full);
}

describe('changedWidgetKinds', () => {
  it('reports every kind on first write', () => {
    expect(changedWidgetKinds(null, base())).toHaveLength(6);
  });

  it('ignores position ticks while playing', () => {
    const prev = base();
    const next = base();
    next.generatedAt += 5_000;
    if (next.nowPlaying) next.nowPlaying.positionSec += 5;
    expect(changedWidgetKinds(prev, next)).toEqual([]);
  });

  it('ignores generatedAt jitter of a second during continuous play', () => {
    const prev = base();
    for (const jitterMs of [1_000, -1_000]) {
      const next = base();
      next.generatedAt += 10_000 + jitterMs;
      if (next.nowPlaying) next.nowPlaying.positionSec += 10;
      expect(changedWidgetKinds(prev, next)).toEqual([]);
    }
  });

  it('reloads Continue Listening on a 30 second seek while playing', () => {
    const prev = base();
    const next = base();
    next.generatedAt += 1_000;
    if (next.nowPlaying) next.nowPlaying.positionSec += 31;
    expect(changedWidgetKinds(prev, next)).toEqual(['ContinueListening']);
  });

  it('reloads Continue Listening on a rate change', () => {
    const prev = base();
    const next = base();
    if (next.nowPlaying) next.nowPlaying.rate = 1.5;
    expect(changedWidgetKinds(prev, next)).toEqual(['ContinueListening']);
  });

  it('accounts for rate when advancing the anchor', () => {
    const prev = base();
    if (prev.nowPlaying) prev.nowPlaying.rate = 2;
    const next = structuredClone(prev);
    next.generatedAt += 10_000;
    if (next.nowPlaying) next.nowPlaying.positionSec += 20;
    expect(changedWidgetKinds(prev, next)).toEqual([]);
  });

  it('reloads Continue Listening on pause', () => {
    const prev = base();
    const next = base();
    if (next.nowPlaying) next.nowPlaying.isPlaying = false;
    expect(changedWidgetKinds(prev, next)).toEqual(['ContinueListening']);
  });

  it('reloads Continue Reading only when last read changes', () => {
    const prev = base();
    const next = base();
    if (next.lastRead) next.lastRead.page = 294;
    expect(changedWidgetKinds(prev, next)).toEqual(['ContinueReading']);
  });

  it('theme change reloads everything', () => {
    const prev = base();
    const next = {...base(), theme: 'light' as const};
    expect(changedWidgetKinds(prev, next)).toHaveLength(6);
  });

  it('reloads Pinned Reciter and Quick Surah when the default reciter changes', () => {
    const prev = base();
    const next = base();
    if (next.defaultReciter) next.defaultReciter.name = 'Someone Else';
    expect(changedWidgetKinds(prev, next)).toEqual([
      'ContinueListening',
      'QuickSurah',
      'PinnedReciter',
    ]);
  });
});
