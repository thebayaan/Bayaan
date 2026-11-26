import React, {useCallback} from 'react'; // @ai
import {View, ActivityIndicator} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {useReciterStore} from '@/store/reciterStore';
import {getReciterBySlug} from '@/services/dataService';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {SURAHS} from '@/data/surahData';
import {usePlayerStore} from '@/services/player/store/playerStore';
// @ai-start
import {getSurahDisplayName} from '@/i18n/format';
import {useLeaveLinkRoute} from '@/hooks/useLeaveLinkRoute';
import type {Track} from '@/types/audio';
// @ai-end

// @ai-start
/**
 * The track a recitation link names, or null when the link does not name
 * something that can be played: an unknown reciter, a surah outside 1 to
 * 114 (".../115" used to queue a "Surah 115" that then failed to load), or a
 * surah this rewayah does not have.
 */
function resolveLinkedTrack(
  slug: string | undefined,
  surah: string | undefined,
  rewayah: string | undefined,
): Track | null {
  if (!slug || !surah) return null;

  const reciter = getReciterBySlug(slug);
  if (!reciter) return null;

  const rw =
    (rewayah && reciter.rewayat.find(r => r.id === rewayah)) ||
    reciter.rewayat[0];
  if (!rw) return null;

  const surahNum = /^\d{1,3}$/.test(surah) ? parseInt(surah, 10) : NaN;
  const surahMeta = SURAHS.find(s => s.id === surahNum);
  if (!surahMeta) return null;
  if (rw.surah_list?.length && !rw.surah_list.includes(surahNum)) return null;

  return {
    id: `${reciter.id}:${surahNum}`,
    url: generateSmartAudioUrl(reciter, surahNum.toString(), rw.id),
    title: getSurahDisplayName(surahMeta),
    artist: reciter.name,
    reciterId: reciter.id,
    artwork: getReciterArtwork(reciter),
    surahId: surahNum.toString(),
    reciterName: reciter.name,
    rewayatId: rw.id,
  };
}

/** Runs `task` now, or as soon as the reciter catalogue has loaded. */
function whenCatalogueLoaded(task: () => void): void {
  if (useReciterStore.getState().isInitialized) {
    task();
    return;
  }
  const unsubscribe = useReciterStore.subscribe(state => {
    if (!state.isInitialized) return;
    unsubscribe();
    task();
  });
}

// A recitation link (app.thebayaan.com/reciter/<slug>/<surah>): play that
// surah and show the reciter.
export default function RecitationDeepLinkReceiver(): React.ReactElement {
  const {slug, surah, rewayah, t} = useLocalSearchParams<{
    slug: string;
    surah: string;
    rewayah?: string;
    t?: string;
  }>();
  const router = useRouter();
  const {theme} = useTheme();

  // Runs once this route has stepped off the root stack, so the tabs the
  // user already had are showing. The route used to redirect to the Home tab
  // instead, which stacks a second copy of the whole tab navigator on top of
  // the first: Back from Home then led to another Home, and every link
  // opened added one more.
  const openRecitation = useCallback(() => {
    whenCatalogueLoaded(() => {
      const track = resolveLinkedTrack(slug, surah, rewayah);
      // Nothing to play: stay on the screen underneath, as an unknown link
      // does.
      if (!track) return;

      const startPlayback = async (): Promise<void> => {
        await usePlayerStore.getState().updateQueue([track], 0);

        const tSec = t ? parseInt(t, 10) : NaN;
        if (!Number.isNaN(tSec) && tSec > 0) {
          try {
            await usePlayerStore.getState().seekTo(tSec);
          } catch {
            // Seek failures are non-fatal — playback still starts at 0.
          }
        }
      };
      startPlayback();

      // After the step back has settled, as before.
      setTimeout(() => {
        router.push({
          pathname: '/(tabs)/(a.home)/reciter/[id]',
          params: {id: track.reciterId},
        });
      }, 100);
    });
  }, [slug, surah, rewayah, t, router]);

  useLeaveLinkRoute(openRecitation);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
      }}>
      <ActivityIndicator color={theme.colors.text} />
    </View>
  );
}
// @ai-end
