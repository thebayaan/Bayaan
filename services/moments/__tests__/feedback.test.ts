// @ai-start
import {
  applyFeedback,
  MAX_ADJUSTMENT,
  MIN_ADJUSTMENT,
  POSITIVE_FACTOR,
  QUICK_SKIP_MS,
  SKIP_FACTOR,
  signalForEnd,
} from '../feedback';
import {buildFeed, FeedCandidate} from '../buildFeed';
import {MOMENT_PASSAGES} from '../passages';

describe('applyFeedback', () => {
  it('lowers a skipped reciter and raises a finished one', () => {
    const skipped = applyFeedback({}, 'a', 'skip');
    expect(skipped.a).toBeCloseTo(SKIP_FACTOR);
    const liked = applyFeedback({}, 'b', 'positive');
    expect(liked.b).toBeCloseTo(POSITIVE_FACTOR);
  });

  it('changes only that reciter and leaves the input alone', () => {
    const before = {a: 1, b: 0.5};
    const after = applyFeedback(before, 'a', 'skip');
    expect(after).toEqual({a: SKIP_FACTOR, b: 0.5});
    expect(before).toEqual({a: 1, b: 0.5});
  });

  it('raises less than a skip lowers', () => {
    const once = applyFeedback(applyFeedback({}, 'a', 'skip'), 'a', 'positive');
    expect(once.a).toBeLessThan(1);
  });

  it('stays within its bounds', () => {
    let adj = {};
    for (let i = 0; i < 20; i++) adj = applyFeedback(adj, 'a', 'skip');
    expect(applyFeedback(adj, 'a', 'skip').a).toBe(MIN_ADJUSTMENT);
    for (let i = 0; i < 40; i++) adj = applyFeedback(adj, 'a', 'positive');
    expect(applyFeedback(adj, 'a', 'positive').a).toBe(MAX_ADJUSTMENT);
  });
});

describe('signalForEnd', () => {
  it('treats a swipe under four seconds as a skip', () => {
    expect(signalForEnd('swiped', 0)).toBe('skip');
    expect(signalForEnd('swiped', QUICK_SKIP_MS - 1)).toBe('skip');
    expect(signalForEnd('swiped', QUICK_SKIP_MS)).toBeNull();
  });

  it('treats a finish as positive and leaving as nothing', () => {
    expect(signalForEnd('completed', 500)).toBe('positive');
    expect(signalForEnd('left', 0)).toBeNull();
  });
});

describe('buildFeed with session adjustments', () => {
  const reciters = Array.from({length: 20}, (_, i) => `r${i}`);
  const candidates: FeedCandidate[] = reciters.flatMap(reciterId =>
    MOMENT_PASSAGES.slice(0, 5).map(passage => ({
      reciterId,
      rewayatId: `${reciterId}-hafs`,
      passage,
    })),
  );

  function countFirst(
    reciterId: string,
    adjustments: Record<string, number> | undefined,
  ): number {
    let hits = 0;
    for (let seed = 0; seed < 400; seed++) {
      const [first] = buildFeed(candidates, {seed, length: 1, adjustments});
      if (first.reciterId === reciterId) hits++;
    }
    return hits;
  }

  it('shows a down-weighted reciter less often', () => {
    const base = countFirst('r3', undefined);
    const lowered = countFirst('r3', {r3: MIN_ADJUSTMENT});
    expect(lowered).toBeLessThan(base / 2);
  });

  it('shows an up-weighted reciter more often', () => {
    const base = countFirst('r3', undefined);
    const raised = countFirst('r3', {r3: MAX_ADJUSTMENT});
    expect(raised).toBeGreaterThan(base);
  });

  it('is the same feed with empty adjustments', () => {
    expect(
      buildFeed(candidates, {seed: 5, length: 30, adjustments: {}}),
    ).toEqual(buildFeed(candidates, {seed: 5, length: 30}));
  });

  it('keeps the spacing rules across the cards it follows', () => {
    const head = buildFeed(candidates, {seed: 9, length: 10});
    const used = new Set(head);
    const tail = buildFeed(
      candidates.filter(c => !used.has(c)),
      {seed: 9, length: 30, precededBy: head, adjustments: {r1: 0.2}},
    );
    expect(tail).toHaveLength(30);
    const feed = [...head, ...tail];
    feed.forEach((item, i) => {
      const window = feed.slice(Math.max(0, i - 15), i).map(c => c.reciterId);
      expect(window).not.toContain(item.reciterId);
      if (i > 0) expect(item.passage.id).not.toBe(feed[i - 1].passage.id);
    });
  });
});
// @ai-end
