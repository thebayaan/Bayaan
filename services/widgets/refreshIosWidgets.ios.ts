import {usePlayerStore} from '@/services/player/store/playerStore';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useLovedStore} from '@/services/player/store/lovedStore';
import {usePlayCountStore} from '@/store/playCountStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {SURAHS} from '@/data/surahData';
import {RECITERS} from '@/data/reciterData';
import {
  getVerseOfTheDayForDate,
  truncateForWidget,
} from '@/utils/verseOfTheDay';
import {ayahOfTheDayWidget} from '@/widgets/ios/AyahOfTheDayWidget';
import {nowPlayingWidget} from '@/widgets/ios/NowPlayingWidget';
import {lastReadWidget} from '@/widgets/ios/LastReadWidget';
import {listeningStatsWidget} from '@/widgets/ios/ListeningStatsWidget';
import {favoritesWidget} from '@/widgets/ios/FavoritesWidget';

// ─── Helpers ───────────────────────────────────────────────

function formatWidgetDate(d: Date): string {
  return d.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
}

function surahById(id: number) {
  return SURAHS[id - 1] ?? SURAHS[0];
}

function reciterById(id: string) {
  return RECITERS.find(r => r.id === id);
}

// ─── Snapshot Builders ─────────────────────────────────────

function buildAyahSnapshot() {
  const d = new Date();
  const v = getVerseOfTheDayForDate(d);
  const reference = `${v.surahName} ${v.surahNumber}:${v.ayahNumber}`;

  return {
    arabicText: truncateForWidget(v.arabicText, 220),
    translation: truncateForWidget(v.translation, 280),
    reference,
    dateLabel: formatWidgetDate(d),
    surahNumber: String(v.surahNumber),
    ayahNumber: String(v.ayahNumber),
  };
}

function buildNowPlayingSnapshot() {
  const state = usePlayerStore.getState();
  const track = state.queue.tracks[state.queue.currentIndex];
  const playing = state.playback.state === 'playing';
  const buffering =
    state.playback.state === 'buffering' || state.playback.buffering;

  if (!track?.title) {
    return {
      title: 'Bayaan',
      subtitle: 'Quran audio',
      statusLabel: 'Nothing playing',
    };
  }

  let statusLabel = 'Paused';
  if (playing) statusLabel = 'Playing';
  else if (buffering) statusLabel = 'Loading…';

  return {
    title: truncateForWidget(track.title, 72),
    subtitle: truncateForWidget(track.reciterName || track.artist || '', 64),
    statusLabel,
  };
}

function buildLastReadSnapshot() {
  const lastPage = mushafSessionStore.getLastReadPage();
  const recentPages = useMushafSettingsStore.getState().recentPages;

  if (!lastPage && recentPages.length === 0) {
    return {
      surahName: '',
      surahNameArabic: '',
      pageNumber: '1',
      versesInfo: '',
      isEmpty: 'true',
    };
  }

  const page = lastPage ?? recentPages[0]?.page ?? 1;
  const surahId = recentPages[0]?.surahId ?? 1;
  const s = surahById(surahId);

  return {
    surahName: s.name,
    surahNameArabic: s.name_arabic,
    pageNumber: String(page),
    versesInfo: `${s.verses_count} verses · ${s.revelation_place}`,
    isEmpty: 'false',
  };
}

function buildListeningStatsSnapshot() {
  const playCounts = usePlayCountStore.getState().playCounts;
  const totalPlays = playCounts.reduce((sum, c) => sum + c.count, 0);
  const uniqueSurahs = playCounts.length;
  const mostPlayed = usePlayCountStore.getState().getMostPlayed(1);
  const top = mostPlayed[0];

  let motivationalText = 'Start listening to track your progress';
  if (totalPlays > 0 && totalPlays < 10) {
    motivationalText = 'Keep going! Build your listening habit';
  } else if (totalPlays >= 10 && totalPlays < 50) {
    motivationalText = `MashaAllah! ${uniqueSurahs} different surahs`;
  } else if (totalPlays >= 50) {
    motivationalText = `Alhamdulillah, ${totalPlays} plays and counting`;
  }

  return {
    totalPlays: String(totalPlays),
    uniqueSurahs: String(uniqueSurahs),
    topSurahName: top ? surahById(top.surahId).name : '',
    topSurahCount: top ? String(top.count) : '0',
    motivationalText,
  };
}

function buildFavoritesSnapshot() {
  const loved = useLovedStore.getState().getLovedTracks();

  if (loved.length === 0) {
    return {
      surahNames: '',
      reciterNames: '',
      totalCount: '0',
      isEmpty: 'true',
    };
  }

  const items = loved.slice(0, 6);
  const surahNames = items.map(t => {
    const s = surahById(Number(t.surahId));
    return s.name;
  });
  const reciterNames = items.map(t => {
    const r = reciterById(t.reciterId);
    return truncateForWidget(r?.name ?? 'Unknown', 24);
  });

  return {
    surahNames: surahNames.join(','),
    reciterNames: reciterNames.join(','),
    totalCount: String(loved.length),
    isEmpty: 'false',
  };
}

// ─── Push All Snapshots ────────────────────────────────────

function pushWidgetSnapshots(): void {
  try {
    ayahOfTheDayWidget.updateSnapshot(buildAyahSnapshot());
    nowPlayingWidget.updateSnapshot(buildNowPlayingSnapshot());
    lastReadWidget.updateSnapshot(buildLastReadSnapshot());
    listeningStatsWidget.updateSnapshot(buildListeningStatsSnapshot());
    favoritesWidget.updateSnapshot(buildFavoritesSnapshot());
  } catch (e) {
    if (__DEV__) console.warn('[iOS Widgets] refresh failed:', e);
  }
}

/**
 * Updates all home screen widgets.
 */
export function refreshIosWidgets(): void {
  pushWidgetSnapshots();
}

// ─── Player Subscription ───────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastPlayerSignature = '';

/**
 * Subscribes to player store changes and refreshes the Now Playing widget (debounced).
 */
export function subscribePlayerToIosWidgets(): () => void {
  const unsubscribe = usePlayerStore.subscribe(state => {
    const track = state.queue.tracks[state.queue.currentIndex];
    const sig = `${track?.id ?? ''}|${state.playback.state}|${
      state.playback.buffering
    }`;
    if (sig === lastPlayerSignature) return;
    lastPlayerSignature = sig;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      try {
        nowPlayingWidget.updateSnapshot(buildNowPlayingSnapshot());
      } catch (e) {
        if (__DEV__)
          console.warn('[iOS Widgets] now playing update failed:', e);
      }
    }, 400);
  });

  return () => {
    unsubscribe();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };
}
