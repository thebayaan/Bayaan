// @ai-generated
// How a Bayaan Now card looks and what it does: its words, colours and
// artwork, whether what it plays is already playing, and where its body
// leads.
import {useCallback} from 'react';
import {shallow} from 'zustand/shallow';
import {useTranslation} from 'react-i18next';
import * as Haptics from 'expo-haptics';
import {useRouter} from 'expo-router';
import {RECITERS} from '@/data/reciterData';
import {SURAHS} from '@/data/surahData';
import {getSystemPlaylistById} from '@/data/systemPlaylists';
import {
  getReciterDisplayName,
  getSurahDisplayName,
  localizeDigits,
} from '@/i18n/format';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {useAdhkarStore} from '@/store/adhkarStore';
import {getSuperCategoryDisplayTitle} from '@/utils/adhkarUtils';
import {
  MESH_PALETTES,
  type MeshPalette,
} from '@/components/hero/SurahGradientMesh';
import {
  NOW_ADHKAR,
  type NowMoment,
  type NowReason,
} from '@/services/bayaanNow/moments';
import {playMoment} from '@/services/bayaanNow/playMoment';
import {ignoreHaptics, type HomeSymbolName} from './homeKit';

/** Each moment's colour, from the Surahs cards' palettes. */
const REASON_PALETTE: Record<NowReason, number> = {
  morning: 2, // golden hour
  evening: 5, // twilight
  bedtime: 1, // ocean depths
  friday: 4, // emerald
  midday: 0,
  upNext: 0,
  occasion: 3,
};

const ADHKAR_SYMBOL: Record<string, HomeSymbolName> = {
  [NOW_ADHKAR.morning]: 'sunrise',
  [NOW_ADHKAR.evening]: 'sunset',
  [NOW_ADHKAR.sleep]: 'sleep',
};

const ADHKAR_TITLE_KEY: Record<
  string,
  'now.adhkar.morning' | 'now.adhkar.evening' | 'now.adhkar.sleep'
> = {
  [NOW_ADHKAR.morning]: 'now.adhkar.morning',
  [NOW_ADHKAR.evening]: 'now.adhkar.evening',
  [NOW_ADHKAR.sleep]: 'now.adhkar.sleep',
};

export type MomentArt =
  | {kind: 'surah'; surahId: number}
  | {kind: 'symbol'; symbol: HomeSymbolName}
  | {kind: 'mosaic'; surahIds: number[]};

export interface MomentView {
  reason: string;
  title: string;
  subtitle: string;
  palette: MeshPalette;
  art: MomentArt;
  /** The large faint mark behind the hero: a surah's name or a symbol. */
  watermark: {glyphSurahId: number} | {symbol: HomeSymbolName};
  playLabel: string;
  status: 'idle' | 'playing' | 'paused';
  /** Plays it, or pauses and resumes it once it is playing. */
  onPlay: () => void;
  /** Opens what the card plays: the reciter, the adhkar or the playlist. */
  onOpen: () => void;
  accessibilityLabel: string;
}

function usePlaybackStatus(moment: NowMoment): MomentView['status'] {
  const player = usePlayerStore(s => {
    const track =
      s.queue.currentIndex >= 0
        ? s.queue.tracks[s.queue.currentIndex]
        : undefined;
    return {
      reciterId: track?.reciterId,
      surahId: track?.surahId,
      state: s.playback.state,
    };
  }, shallow);
  const adhkar = useAdhkarSessionStore(s =>
    s.session ? `${s.session.listId}|${s.session.status}` : null,
  );

  switch (moment.kind) {
    case 'surah':
    case 'bedtime': {
      const current =
        player.reciterId === moment.reciterId &&
        player.surahId === String(moment.surahId);
      if (!current) return 'idle';
      return player.state === 'playing' || player.state === 'buffering'
        ? 'playing'
        : 'paused';
    }
    case 'adhkar': {
      if (!adhkar) return 'idle';
      const [listId, status] = adhkar.split('|');
      if (listId !== moment.superId) return 'idle';
      return status === 'paused' ? 'paused' : 'playing';
    }
    case 'playlist':
      return 'idle';
  }
}

export function useMomentView(moment: NowMoment): MomentView {
  const {t} = useTranslation('home');
  const router = useRouter();
  const {play, pause} = usePlayerActions();
  const status = usePlaybackStatus(moment);
  const superCategory = useAdhkarStore(s =>
    moment.kind === 'adhkar'
      ? s.getSuperCategoryById(moment.superId)
      : undefined,
  );

  const onPlay = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      ignoreHaptics,
    );
    if (status !== 'idle') {
      if (moment.kind === 'adhkar') {
        useAdhkarSessionStore.getState().dispatch({type: 'toggle'});
        return;
      }
      (status === 'playing' ? pause() : play()).catch(error =>
        console.error('Bayaan Now: could not toggle playback', error),
      );
      return;
    }
    playMoment(moment).catch(error =>
      console.error('Bayaan Now: could not play', error),
    );
  }, [moment, status, play, pause]);

  const onOpen = useCallback(() => {
    Haptics.selectionAsync().catch(ignoreHaptics);
    switch (moment.kind) {
      case 'surah':
      case 'bedtime':
        router.push({
          pathname: '/(tabs)/(a.home)/reciter/[id]',
          params: {id: moment.reciterId},
        });
        return;
      case 'adhkar':
        router.push({
          pathname: '/(tabs)/(a.home)/adhkar/[superId]',
          params: {superId: moment.superId},
        });
        return;
      case 'playlist':
        router.push({
          pathname: '/(tabs)/(a.home)/system-playlist/[id]',
          params: {id: moment.playlistId},
        });
    }
  }, [moment, router]);

  const palette = MESH_PALETTES[REASON_PALETTE[moment.reason]];
  const reason = t(`now.reason.${moment.reason}`);
  const playLabel =
    status === 'playing'
      ? t('now.pause')
      : status === 'paused'
        ? t('now.resume')
        : moment.kind === 'adhkar'
          ? t('now.start')
          : t('now.play');

  let title = '';
  let subtitle = '';
  let art: MomentArt;
  let watermark: MomentView['watermark'];

  switch (moment.kind) {
    case 'surah':
    case 'bedtime': {
      const surah = SURAHS[moment.surahId - 1];
      const reciter = RECITERS.find(r => r.id === moment.reciterId);
      title = surah ? getSurahDisplayName(surah) : '';
      const name = reciter ? getReciterDisplayName(reciter) : '';
      subtitle =
        moment.kind === 'bedtime'
          ? t('now.withSleepTimer', {
              reciter: name,
              count: moment.sleepMinutes,
              formatted: localizeDigits(moment.sleepMinutes),
            })
          : moment.reason === 'friday'
            ? t('now.fridaySurah', {reciter: name})
            : moment.reason === 'upNext'
              ? t('now.upNextSurah', {reciter: name})
              : name;
      art = {kind: 'surah', surahId: moment.surahId};
      watermark = {glyphSurahId: moment.surahId};
      break;
    }
    case 'adhkar': {
      const symbol = ADHKAR_SYMBOL[moment.superId] ?? 'moon';
      title = superCategory
        ? getSuperCategoryDisplayTitle(superCategory)
        : t(ADHKAR_TITLE_KEY[moment.superId] ?? 'now.adhkar.generic');
      subtitle = t('now.adhkarLine');
      art = {kind: 'symbol', symbol};
      watermark = {symbol};
      break;
    }
    case 'playlist': {
      const playlist = getSystemPlaylistById(moment.playlistId);
      const surahIds = playlist?.items.map(i => i.surahId) ?? [];
      title = playlist?.title ?? '';
      subtitle = t('now.playlistLine', {
        count: surahIds.length,
        formatted: localizeDigits(surahIds.length),
      });
      art = {kind: 'mosaic', surahIds: surahIds.slice(0, 4)};
      watermark = {
        symbol: moment.reason === 'morning' ? 'sunrise' : 'playlist',
      };
      break;
    }
  }

  return {
    reason,
    title,
    subtitle,
    palette,
    art,
    watermark,
    playLabel,
    status,
    onPlay,
    onOpen,
    accessibilityLabel: `${reason}. ${title}. ${subtitle}`,
  };
}
