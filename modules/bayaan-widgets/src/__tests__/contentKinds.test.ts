import snapshotFull from '../__fixtures__/snapshot.full.json';
import contentFull from '../__fixtures__/content.full.json';
import type {WidgetSnapshot} from '../snapshot';
import type {WidgetContent} from '../content';
import {
  ALL_CONTENT_WIDGET_KINDS,
  changedContentKindsForContent,
  changedContentKindsForSnapshot,
} from '../contentKinds';

function snap(): WidgetSnapshot {
  return structuredClone(snapshotFull) as WidgetSnapshot;
}

function content(): WidgetContent {
  return structuredClone(contentFull) as WidgetContent;
}

describe('changedContentKindsForSnapshot', () => {
  it('reloads every snapshot-driven kind on the first write', () => {
    expect(changedContentKindsForSnapshot(null, snap())).toEqual([
      'RecentlyPlayed',
      'Bedtime',
      'BayaanNow',
    ]);
  });

  it('ignores playback ticks', () => {
    const prev = snap();
    const next = snap();
    next.generatedAt += 1_000;
    if (next.nowPlaying) next.nowPlaying.positionSec += 1;
    expect(changedContentKindsForSnapshot(prev, next)).toEqual([]);
  });

  it('reloads Bayaan Now when Continue Listening would reload', () => {
    const next = snap();
    if (next.nowPlaying) next.nowPlaying.isPlaying = false;
    expect(changedContentKindsForSnapshot(snap(), next)).toEqual(['BayaanNow']);
  });

  it('reloads Recently Played and Bayaan Now when recent changes', () => {
    const next = snap();
    next.recent = [...next.upNext];
    expect(changedContentKindsForSnapshot(snap(), next)).toEqual([
      'RecentlyPlayed',
      'BayaanNow',
    ]);
  });

  it('reloads Recently Played and Bedtime when the default reciter changes', () => {
    const next = snap();
    if (next.defaultReciter) next.defaultReciter.name = 'Someone Else';
    expect(changedContentKindsForSnapshot(snap(), next)).toEqual([
      'RecentlyPlayed',
      'Bedtime',
      'BayaanNow',
    ]);
  });
});

describe('changedContentKindsForContent', () => {
  it('reloads every content-driven kind on the first write', () => {
    expect(changedContentKindsForContent(null, content())).toEqual([
      'LibraryShelf',
      'ReciterSpotlight',
      'Bedtime',
      'BayaanNow',
    ]);
  });

  it('ignores generatedAt', () => {
    const next = content();
    next.generatedAt += 60_000;
    expect(changedContentKindsForContent(content(), next)).toEqual([]);
  });

  it('maps each slice to its kinds', () => {
    const lib = content();
    lib.downloadCount += 1;
    expect(changedContentKindsForContent(content(), lib)).toEqual([
      'LibraryShelf',
    ]);
    const spot = content();
    spot.spotlight = spot.spotlight.slice(1);
    expect(changedContentKindsForContent(content(), spot)).toEqual([
      'ReciterSpotlight',
    ]);
    const sleep = content();
    sleep.sleepTimerEndsAt = null;
    expect(changedContentKindsForContent(content(), sleep)).toEqual([
      'Bedtime',
      'BayaanNow',
    ]);
  });

  it('lists eight kinds', () => {
    expect(ALL_CONTENT_WIDGET_KINDS).toHaveLength(8);
  });
});
