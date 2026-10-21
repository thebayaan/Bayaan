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

export interface MomentCardData {
  key: string;
  reciter: Reciter;
  rewayat: Rewayat;
  passage: MomentPassage;
  clip: MomentClip;
  url: string;
}

const FEED_LENGTH = 200;
/** Cards resolved ahead of the one on screen. */
const LOOK_AHEAD = 3;

function isHafs(rewayat: Rewayat): boolean {
  return rewayat.name.toLowerCase().includes('hafs');
}

/** Every reciter and passage pair that has timing for the passage's surah. */
function collectCandidates(): FeedCandidate[] {
  const candidates: FeedCandidate[] = [];
  for (const reciter of RECITERS) {
    const rewayat = reciter.rewayat.find(
      r => isHafs(r) && r.has_timestamps && r.timestamps_surah_list?.length,
    );
    if (!rewayat) continue;
    const timed = new Set(rewayat.timestamps_surah_list);
    for (const passage of MOMENT_PASSAGES) {
      if (timed.has(passage.surah)) {
        candidates.push({
          reciterId: reciter.id,
          rewayatId: rewayat.id,
          passage,
        });
      }
    }
  }
  return candidates;
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
  if (!timestamps) return null;
  const clip = buildMoment(candidate.passage, timestamps);
  if (!clip) return null;
  return {
    key: `${index}-${reciter.id}-${candidate.passage.id}`,
    reciter,
    rewayat,
    passage: candidate.passage,
    clip,
    url: generateSmartAudioUrl(
      reciter,
      String(candidate.passage.surah),
      rewayat.id,
    ),
  };
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

  const fill = useCallback(async (activeIndex: number) => {
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
        }
      }
    } finally {
      resolvingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const favoriteIds = new Set(
      useFavoriteRecitersStore.getState().favoriteReciters.map(r => r.id),
    );
    orderRef.current = buildFeed(collectCandidates(), {
      seed: Date.now(),
      length: FEED_LENGTH,
      favoriteIds,
      history: {plays: useMomentsStore.getState().plays},
    });
    fill(0);
  }, [fill]);

  return {cards, loading, ensureAhead: fill};
}
// @ai-end
