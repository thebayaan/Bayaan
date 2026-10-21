// @ai-start
import {useCallback, useEffect, useRef, useState} from 'react';
import {RECITERS, Reciter, Rewayat} from '@/data/reciterData';
import {timestampService} from '@/services/timestamps/TimestampService';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {useFavoriteRecitersStore} from '@/store/favoriteRecitersStore';
import {useMomentsStore} from '@/store/momentsStore';
import {MOMENT_PASSAGES, MomentPassage} from './passages';
import {buildMoment, MomentClip} from './buildMoment';
import {buildFeed, FeedCandidate} from './buildFeed';
import {clipFromSnippet, Snippet, snippetToCandidate} from './snippets';
import {loadMomentSnippets} from './snippetSource';
import {
  chooseSpanEnd,
  getBundledThemesBySurah,
  themeCandidatesForReciter,
} from './themePassages';
import {ClipRequest, momentsClipCache} from './clipCache';
import {getAyahArabic} from './verses';

export interface MomentCardData {
  key: string;
  reciter: Reciter;
  rewayat: Rewayat;
  passage: MomentPassage;
  clip: MomentClip;
  url: string;
  /** The pre-cut clip to download and play, for a backend snippet. */
  clipFile?: ClipRequest;
}

const FEED_LENGTH = 200;
/** Cards resolved ahead of the one on screen. */
const LOOK_AHEAD = 3;

function isHafs(rewayat: Rewayat): boolean {
  return rewayat.name.toLowerCase().includes('hafs');
}

/** Cards downloaded ahead of the one on screen, and behind it. */
const CLIP_PREFETCH_AHEAD = 3;
const CLIP_PREFETCH_BEHIND = 1;

/**
 * Every reciter and passage pair that has timing for the passage's surah:
 * the curated passages, plus a sample of passages derived from the thematic
 * grouping (picked less often).
 */
function collectOnDeviceCandidates(seed: number): FeedCandidate[] {
  const candidates: FeedCandidate[] = [];
  const themesBySurah = getBundledThemesBySurah();
  for (const reciter of RECITERS) {
    const rewayat = reciter.rewayat.find(
      r => isHafs(r) && r.has_timestamps && r.timestamps_surah_list?.length,
    );
    if (!rewayat) continue;
    const timed = new Set(rewayat.timestamps_surah_list);
    const curated = MOMENT_PASSAGES.filter(p => timed.has(p.surah));
    for (const passage of curated) {
      candidates.push({
        reciterId: reciter.id,
        rewayatId: rewayat.id,
        passage,
      });
    }
    candidates.push(
      ...themeCandidatesForReciter(
        reciter.id,
        rewayat.id,
        timed,
        themesBySurah,
        MOMENT_PASSAGES,
        {seed},
      ),
    );
  }
  return candidates;
}

/**
 * Backend snippets whose reciter and rewayat this catalog knows. Only Hafs
 * for now: the backend does not filter, and the card text is Hafs.
 */
function collectSnippetCandidates(snippets: Snippet[]): FeedCandidate[] {
  const candidates: FeedCandidate[] = [];
  for (const snippet of snippets) {
    const reciter = RECITERS.find(r => r.id === snippet.reciterId);
    const rewayat = reciter?.rewayat.find(r => r.id === snippet.rewayatId);
    if (!rewayat || !isHafs(rewayat)) continue;
    candidates.push(snippetToCandidate(snippet));
  }
  return candidates;
}

function arabicLength(surah: number, ayah: number): number {
  return getAyahArabic(surah, ayah).length;
}

function resolveClip(
  candidate: FeedCandidate,
  timestamps: Awaited<
    ReturnType<typeof timestampService.getTimestampsForSurah>
  >,
): {passage: MomentPassage; clip: MomentClip} | null {
  if (candidate.snippet) {
    return {
      passage: candidate.passage,
      clip: clipFromSnippet(candidate.snippet, timestamps, arabicLength),
    };
  }
  if (!timestamps) return null;
  let passage = candidate.passage;
  if (candidate.themeEnds) {
    const end = chooseSpanEnd(
      passage.surah,
      passage.fromAyah,
      candidate.themeEnds,
      timestamps,
    );
    if (end === null) return null;
    passage = {
      id: `${passage.surah}:${passage.fromAyah}-${end}`,
      surah: passage.surah,
      fromAyah: passage.fromAyah,
      toAyah: end,
    };
  }
  const clip = buildMoment(passage, timestamps);
  return clip ? {passage, clip} : null;
}

async function resolveCard(
  candidate: FeedCandidate,
  index: number,
): Promise<MomentCardData | null> {
  const reciter = RECITERS.find(r => r.id === candidate.reciterId);
  const rewayat = reciter?.rewayat.find(r => r.id === candidate.rewayatId);
  if (!reciter || !rewayat) return null;
  const timestamps = await timestampService.getTimestampsForSurah(
    rewayat.id,
    candidate.passage.surah,
  );
  const resolved = resolveClip(candidate, timestamps);
  if (!resolved) return null;
  const {passage, clip} = resolved;
  const clipUrl = candidate.snippet?.clipUrl;
  return {
    key: `${index}-${reciter.id}-${passage.id}`,
    reciter,
    rewayat,
    passage,
    clip,
    url: generateSmartAudioUrl(reciter, String(passage.surah), rewayat.id),
    clipFile:
      candidate.snippet && clipUrl
        ? {id: candidate.snippet.id, url: clipUrl}
        : undefined,
  };
}

/** Downloads the clips of the next few cards and the previous one. */
function prefetchClips(cards: MomentCardData[], activeIndex: number): void {
  const wanted: ClipRequest[] = [];
  for (let i = 1; i <= CLIP_PREFETCH_AHEAD; i++) {
    const file = cards[activeIndex + i]?.clipFile;
    if (file) wanted.push(file);
  }
  for (let i = 1; i <= CLIP_PREFETCH_BEHIND; i++) {
    const file = cards[activeIndex - i]?.clipFile;
    if (file) wanted.push(file);
  }
  const current = cards[activeIndex]?.clipFile;
  momentsClipCache.prefetch(wanted, current ? [current, ...wanted] : wanted);
}

/**
 * Builds the Moments feed for this session and resolves clips a few cards
 * ahead of the one on screen. Candidates whose timing does not produce a clean
 * clip are dropped silently.
 */
export function useMomentsFeed() {
  const [cards, setCards] = useState<MomentCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const orderRef = useRef<FeedCandidate[]>([]);
  const cursorRef = useRef(0);
  const resolvingRef = useRef(false);
  const cardsRef = useRef<MomentCardData[]>([]);
  const wantedRef = useRef(0);
  const activeRef = useRef(0);

  const fill = useCallback(async (activeIndex: number) => {
    activeRef.current = activeIndex;
    prefetchClips(cardsRef.current, activeIndex);
    wantedRef.current = Math.max(
      wantedRef.current,
      activeIndex + 1 + LOOK_AHEAD,
    );
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    try {
      while (
        cardsRef.current.length < wantedRef.current &&
        cursorRef.current < orderRef.current.length
      ) {
        const index = cursorRef.current++;
        const card = await resolveCard(orderRef.current[index], index);
        if (card) {
          cardsRef.current = [...cardsRef.current, card];
          setCards(cardsRef.current);
          if (card.clipFile) prefetchClips(cardsRef.current, activeRef.current);
        }
      }
    } finally {
      resolvingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void momentsClipCache.init();
    (async () => {
      const snippets = await loadMomentSnippets().catch(() => []);
      if (cancelled) return;
      const seed = Date.now();
      // Server snippets when there are any, else build them on the device.
      let candidates = collectSnippetCandidates(snippets);
      if (candidates.length === 0) candidates = collectOnDeviceCandidates(seed);
      const favoriteIds = new Set(
        useFavoriteRecitersStore.getState().favoriteReciters.map(r => r.id),
      );
      orderRef.current = buildFeed(candidates, {
        seed,
        length: FEED_LENGTH,
        favoriteIds,
        history: {plays: useMomentsStore.getState().plays},
      });
      fill(activeRef.current);
    })();
    return () => {
      cancelled = true;
    };
  }, [fill]);

  return {cards, loading, ensureAhead: fill};
}
// @ai-end
