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
import {createMMKV, type MMKV} from 'react-native-mmkv'; // @ai

const OPENING_WORDS = 6;
const countsForToday = createCountDayTracker();

// @ai-start
// The Mushaf data loads after the splash, so a snapshot can come before it. The
// last text of the page stays, so the widget keeps its line if the process ends
// before the load. Opens lazily: a throw must not stop a snapshot.
let openingStore: MMKV | null | undefined;
function lastOpeningStore(): MMKV | null {
  if (openingStore !== undefined) return openingStore;
  try {
    openingStore = createMMKV({id: 'widget-opening'});
  } catch {
    openingStore = null;
  }
  return openingStore;
}

function rememberOpening(page: number, text: string): void {
  const store = lastOpeningStore();
  if (!store) return;
  if (store.getNumber('page') === page && store.getString('text') === text) {
    return;
  }
  store.set('page', page);
  store.set('text', text);
}
// @ai-end

function openingTextForPage(page: number): string {
  // @ai-start
  if (!digitalKhattDataService.initialized) {
    const store = lastOpeningStore();
    return store?.getNumber('page') === page
      ? (store.getString('text') ?? '')
      : '';
  }
  // @ai-end
  const firstKey = mushafVerseMapService.getOrderedVerseKeysForPage(page)[0];
  if (!firstKey) return '';
  // @ai-start
  const text = digitalKhattDataService
    .getVerseText(firstKey)
    .split(' ')
    .slice(0, OPENING_WORDS)
    .join(' ');
  if (text) rememberOpening(page, text);
  return text;
  // @ai-end
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
