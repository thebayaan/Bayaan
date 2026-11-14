// @ai-generated
/**
 * Repro for a nit from the PR #487 deep review (item 7, "Smaller"). This
 * one is NOT in the posted review comment: the review judged it a precision
 * nit, not a user bug, because at this head the Hafs text of a verse key
 * does not change once loaded, and a new surah or reciter resets the ticker.
 *
 * What it shows: the ayah ticker's dedupe key is `${number}:${hasText}`, so
 * a changed text for the same ayah number is never published.
 *
 * Expected: after the verse text changes and the ticker ticks, the published
 * ayah carries the new text.
 *
 * On the PR head: the change is swallowed and the last published text is
 * still 'old', so the test fails at the last text assertion.
 */
import type {NowPlayingAyah} from 'bayaan-widgets';
import {nowPlayingSnapshot} from '@/test-utils/widgetSnapshots';
import {createTimingNumbering} from '@/utils/timestampNumbering';
import {rewayahVerseMapService} from '@/services/mushaf/RewayahVerseMapService';
import {createAyahTicker} from '@/services/widgets/live-activity/ayahTicker';

it('a different text for the same ayah is published', async () => {
  jest.useFakeTimers({now: 1_000_000});
  let text = 'old';
  const published: Array<NowPlayingAyah | null> = [];
  const ticker = createAyahTicker({
    loadTimestamps: async () => [
      {
        surahNumber: 18,
        ayahNumber: 1,
        timestampFrom: 5000,
        timestampTo: 12000,
        durationMs: 7000,
      },
    ],
    resolveNumbering: async (_r, surah, entries) =>
      createTimingNumbering({
        surah,
        mode: 'hafs',
        reciterRewayah: 'hafs',
        reason: 'test',
        entries,
        verseMap: rewayahVerseMapService,
      }),
    hafsVerseCount: () => 110,
    verseText: () => text,
    setAyah: a => published.push(a),
    now: () => Date.now(),
  });
  try {
    ticker.onSnapshot(nowPlayingSnapshot({positionSec: 10}, 1_000_000));
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    expect(published.at(-1)?.number).toBe(1);
    expect(published.at(-1)?.text).toBe('old');
    text = 'new';
    ticker.tick();
    // Expected: the new text is published. On the PR head it is swallowed.
    expect(published.at(-1)?.text).toBe('new');
  } finally {
    ticker.stop();
    jest.useRealTimers();
  }
});
