// What the long-press menus act on: which recitation a reciter's Play uses,
// and which voice a surah menu plays, loves and saves in. Pure, so every
// menu (and the reciter page) makes the same choice.
import type {Reciter, Rewayah} from '../types/reciter';
import {groupRewayat} from './browseCatalog';
import {
  chooseRewayah,
  randomSurah,
  voiceForSurah,
  type PlayItemInput,
  type PlayRequest,
} from './playbackRouting';

/**
 * The recitation a reciter page opens on: the fullest rewayah, murattal
 * first (Alafasi's Hafs, not his six surahs of Ad-Duri).
 */
export function defaultRewayah(rewayat: readonly Rewayah[]): Rewayah | null {
  return groupRewayat(rewayat)[0]?.items[0] ?? null;
}

/**
 * "Play" / "Shuffle play" for a reciter: their default recitation from its
 * first surah, or from a random one with shuffle on. Without known rewayat
 * it asks for Al-Fatihah and leaves the lookup (and any failure) to the
 * player.
 */
export function reciterPlayRequest(
  reciterId: string,
  rewayat: readonly Rewayah[],
  shuffle: boolean,
): PlayRequest {
  const rewayah = defaultRewayah(rewayat);
  const list = rewayah?.surah_list.filter(n => n > 0) ?? [];
  const surahNumber = (shuffle ? randomSurah(list) : list[0]) ?? 1;
  return {
    reciterId,
    ...(rewayah ? {rewayahId: rewayah.id} : {}),
    surahNumber,
    ...(shuffle ? {shuffle: true} : {}),
    source: 'reciter-menu',
  };
}

/**
 * The voice a surah menu acts in. The reciter (and rewayah) it was opened
 * with when given; otherwise the first candidate (default reciter, then
 * featured) who has the surah. The rewayah is filled in from what is known
 * about the reciter, so a love or playlist entry names its recitation.
 */
export function surahMenuVoice(
  target: {surahNumber: number; reciterId?: string; rewayahId?: string},
  candidates: readonly Reciter[],
  rewayatOf: (reciter: Reciter) => readonly Rewayah[],
): PlayItemInput | null {
  const {surahNumber} = target;
  if (target.reciterId) {
    const reciter = candidates.find(r => r.id === target.reciterId);
    const rewayah =
      target.rewayahId ??
      (reciter
        ? chooseRewayah(rewayatOf(reciter), surahNumber)?.id
        : undefined);
    return {
      reciterId: target.reciterId,
      surahNumber,
      ...(rewayah ? {rewayahId: rewayah} : {}),
    };
  }
  return voiceForSurah(candidates, surahNumber);
}
