// services/widgets/collectSnapshotInput.ts
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useReciterStore} from '@/store/reciterStore';
import {useThemeStore} from '@/store/themeStore';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {getSurahOfTheDay} from '@/utils/quranPages';
import {hasArtwork, localDayKey} from 'bayaan-widgets';
import {useAdhkarStore} from '@/store/adhkarStore';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore'; // @ai
import type {WidgetAdhkarPlayback} from 'bayaan-widgets'; // @ai
import {
  buildTasbeehEntries,
  createCountDayTracker,
  TASBEEH_ADHKAR,
} from './buildCatalog';
import {
  artworkFileName,
  surahArtworkFileName,
  SnapshotInput,
} from './buildSnapshot';
import {isWidgetEnabled} from './enabledWidgets';

const OPENING_WORDS = 6;
const countsForToday = createCountDayTracker();

function openingTextForPage(page: number): string {
  if (!digitalKhattDataService.initialized) return '';
  const firstKey = mushafVerseMapService.getOrderedVerseKeysForPage(page)[0];
  if (!firstKey) return '';
  return digitalKhattDataService
    .getVerseText(firstKey)
    .split(' ')
    .slice(0, OPENING_WORDS)
    .join(' ');
}

// @ai-start
// Lets the Adhkar widgets show pause while their list plays.
function adhkarPlayback(): WidgetAdhkarPlayback | null {
  const session = useAdhkarSessionStore.getState().session;
  const dhikrId = session?.items[session.index]?.dhikrId;
  if (!session || !dhikrId) return null;
  return {
    superId: session.listId,
    dhikrId,
    isPlaying: session.status !== 'paused',
  };
}
// @ai-end

function surahIdForPage(page: number): number | null {
  if (!digitalKhattDataService.initialized) return null;
  return digitalKhattDataService.getPageToSurah()[page] ?? null;
}

export function collectSnapshotInput(now: Date): SnapshotInput {
  const player = usePlayerStore.getState();
  const reciter = useReciterStore.getState().defaultReciter;
  return {
    now: now.getTime(),
    theme: useThemeStore.getState().themeMode,
    queueTracks: player.queue.tracks,
    currentIndex: player.queue.currentIndex,
    isPlaying: player.playback.state === 'playing',
    positionSec: player.playback.position,
    durationSec: player.playback.duration,
    rate: player.playback.rate,
    recentTracks: useRecentlyPlayedStore.getState().recentTracks,
    defaultReciter: reciter.id === '' ? null : reciter,
    lastReadPage: mushafSessionStore.getLastReadPage(),
    openingTextForPage,
    surahIdForPage,
    tasbeeh: isWidgetEnabled('Tasbeeh')
      ? buildTasbeehEntries(
          TASBEEH_ADHKAR,
          countsForToday(
            useAdhkarStore.getState().dhikrCounts,
            localDayKey(now),
          ),
          localDayKey(now),
        )
      : {},
    artworkFileFor: id => {
      const file = artworkFileName(id);
      return hasArtwork(file) ? file : null;
    },
    surahArtworkFileFor: id => {
      const file = surahArtworkFileName(id);
      return hasArtwork(file) ? file : null;
    },
    surahOfTheDayId: getSurahOfTheDay(now).id,
    adhkar: adhkarPlayback(), // @ai
  };
}
