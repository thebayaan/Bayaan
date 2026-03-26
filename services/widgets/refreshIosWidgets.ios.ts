import {usePlayerStore} from '@/services/player/store/playerStore';
import {
  getVerseOfTheDayForDate,
  truncateForWidget,
} from '@/utils/verseOfTheDay';
import {ayahOfTheDayWidget} from '@/widgets/ios/AyahOfTheDayWidget';
import {nowPlayingWidget} from '@/widgets/ios/NowPlayingWidget';
import {bayaanShortcutsWidget} from '@/widgets/ios/BayaanShortcutsWidget';

function formatWidgetDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function buildAyahSnapshot() {
  const d = new Date();
  const v = getVerseOfTheDayForDate(d);
  const reference = `${v.surahName} ${v.surahNumber}:${v.ayahNumber}`;

  return {
    arabicText: truncateForWidget(v.arabicText, 220),
    translation: truncateForWidget(v.translation, 280),
    reference,
    dateLabel: formatWidgetDate(d),
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
      statusLabel: 'Nothing playing — tap to open',
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

const shortcutsSnapshot = {
  headline: 'Bayaan',
  detail: 'Mushaf · Reciters · Playlists',
};

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastPlayerSignature = '';

function pushWidgetSnapshots(): void {
  try {
    ayahOfTheDayWidget.updateSnapshot(buildAyahSnapshot());
    nowPlayingWidget.updateSnapshot(buildNowPlayingSnapshot());
    bayaanShortcutsWidget.updateSnapshot(shortcutsSnapshot);
  } catch (e) {
    if (__DEV__) console.warn('[iOS Widgets] refresh failed:', e);
  }
}

/**
 * Updates home screen widgets (Ayah of the Day, Now Playing, shortcuts).
 */
export function refreshIosWidgets(): void {
  pushWidgetSnapshots();
}

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
