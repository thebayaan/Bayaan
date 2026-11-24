// @ai-generated
// How a Bayaan Now card looks and what it does: its words and scene, whether what it plays is already playing, and where its body
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
  NOW_ADHKAR,
  sceneFor,
  type NowMoment,
  type NowReason,
} from '@/services/bayaanNow/moments';
import {playMoment} from '@/services/bayaanNow/playMoment';
import {localize, type NowLook} from '@/services/bayaanNow/look';
import type {SceneId} from '@/services/bayaanNow/scenes';
import {ignoreHaptics} from './homeKit';

/** The reasons that only say what time it is: their label comes from the scene. */
const TIME_SCENE_LABEL: Partial<
  Record<
    SceneId,
    | 'now.scene.tahajjud'
    | 'now.scene.fajr'
    | 'now.scene.duha'
    | 'now.scene.afternoon'
    | 'now.scene.maghrib'
    | 'now.scene.bedtime'
  >
> = {
  tahajjud: 'now.scene.tahajjud',
  fajr: 'now.scene.fajr',
  duha: 'now.scene.duha',
  afternoon: 'now.scene.afternoon',
  maghrib: 'now.scene.maghrib',
  bedtime: 'now.scene.bedtime',
};
const TIME_REASONS: ReadonlySet<NowReason> = new Set<NowReason>([
  'morning',
  'midday',
  'evening',
  'bedtime',
]);

/** Moments whose title says why rather than what plays. */
const REASON_TITLE: Partial<
  Record<
    NowReason,
    | 'now.title.night'
    | 'now.title.lastHour'
    | 'now.title.qadr'
    | 'now.title.arafah'
    | 'now.title.ashura'
  >
> = {
  night: 'now.title.night',
  lastHour: 'now.title.lastHour',
  qadr: 'now.title.qadr',
  arafah: 'now.title.arafah',
  ashura: 'now.title.ashura',
};

const ADHKAR_TITLE_KEY: Record<
  string,
  | 'now.adhkar.morning'
  | 'now.adhkar.evening'
  | 'now.adhkar.sleep'
  | 'now.adhkar.dua'
> = {
  [NOW_ADHKAR.morning]: 'now.adhkar.morning',
  [NOW_ADHKAR.evening]: 'now.adhkar.evening',
  [NOW_ADHKAR.sleep]: 'now.adhkar.sleep',
  [NOW_ADHKAR.dua]: 'now.adhkar.dua',
};

export interface MomentView {
  reason: string;
  /** Its own scene or image, else the one sceneFor picks. */
  look: NowLook;
  title: string;
  subtitle: string;
  /** A short note after the subtitle (the sleep timer). */
  badge: string | null;
  playLabel: string;
  status: 'idle' | 'playing' | 'paused';
  /** Plays it, or pauses and resumes it once it is playing. */
  onPlay: () => void;
  /** Opens it to read: the surah in the Mushaf, the adhkar, or the playlist. */
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

export function useMomentView(moment: NowMoment, now: Date): MomentView {
  const {t, i18n} = useTranslation('home');
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
        // Not playing it means reading it: open the surah in the Mushaf.
        router.push({
          pathname: '/mushaf',
          params: {surah: String(moment.surahId)},
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

  const language = i18n.language;
  const content = moment.content;
  const look: NowLook = moment.look ?? {
    kind: 'scene',
    scene: sceneFor(moment, now),
  };
  const reason =
    localize(content?.label, language) ?? momentLabel(moment, look, t);
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
  let badge: string | null = null;

  switch (moment.kind) {
    case 'surah':
    case 'bedtime': {
      const surah = SURAHS[moment.surahId - 1];
      const reciter = RECITERS.find(r => r.id === moment.reciterId);
      title = surah ? getSurahDisplayName(surah) : '';
      const name = reciter ? getReciterDisplayName(reciter) : '';
      if (moment.kind === 'bedtime') {
        badge = t('now.sleepTimer', {
          count: moment.sleepMinutes,
          formatted: localizeDigits(moment.sleepMinutes),
        });
      }
      const reasonTitle = REASON_TITLE[moment.reason];
      if (reasonTitle) {
        // "Stand in the night", with the surah it plays under it.
        subtitle = t('now.surahLine', {surah: title, reciter: name});
        title = t(reasonTitle);
      } else {
        subtitle =
          moment.kind === 'bedtime'
            ? name
            : moment.reason === 'friday'
              ? t('now.fridaySurah', {reciter: name})
              : moment.reason === 'upNext'
                ? t('now.upNextSurah', {reciter: name})
                : name;
      }
      break;
    }
    case 'adhkar': {
      // "Evening adhkar" says more than the category's short "Evening".
      const key = ADHKAR_TITLE_KEY[moment.superId];
      const reasonTitle = REASON_TITLE[moment.reason];
      title = reasonTitle
        ? t(reasonTitle)
        : key
          ? t(key)
          : superCategory
            ? getSuperCategoryDisplayTitle(superCategory)
            : t('now.adhkar.generic');
      subtitle =
        moment.superId === NOW_ADHKAR.dua
          ? t('now.duaLine')
          : t('now.adhkarLine');
      break;
    }
    case 'playlist': {
      const playlist = getSystemPlaylistById(moment.playlistId);
      const count = playlist?.items.length ?? 0;
      title = playlist?.title ?? '';
      subtitle = t('now.playlistLine', {
        count,
        formatted: localizeDigits(count),
      });
      break;
    }
  }

  title = localize(content?.title, language) ?? title;
  subtitle = localize(content?.subtitle, language) ?? subtitle;
  return {
    reason,
    look,
    title,
    subtitle,
    badge,
    playLabel,
    status,
    onPlay,
    onOpen,
    accessibilityLabel: `${reason}. ${title}. ${subtitle}`,
  };
}

type T = ReturnType<typeof useTranslation<'home'>>['t'];

/** The small label: the special day, else why it is showing, else the hour. */
function momentLabel(moment: NowMoment, look: NowLook, t: T): string {
  const day = moment.day;
  if (day) {
    switch (day.kind) {
      case 'ramadan':
        return t('now.day.ramadan', {formatted: localizeDigits(day.day)});
      case 'newYear':
        return t('now.day.newYear', {year: localizeDigits(day.year)});
      default:
        return t(`now.day.${day.kind}`);
    }
  }
  if (TIME_REASONS.has(moment.reason) && look.kind === 'scene') {
    const key = TIME_SCENE_LABEL[look.scene];
    if (key) return t(key);
  }
  return t(`now.reason.${moment.reason}`);
}
