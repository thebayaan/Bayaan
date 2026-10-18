import React, {useMemo} from 'react';
import {Text, View} from 'react-native';
import {SurahArtwork} from '../brand/SurahArtwork';
import {FocusIcon} from '../primitives/focusContext';
import {MenuRow, menuStyles} from './ReciterContextMenu';
import {useContextMenuStore} from '../../store/contextMenuStore';
import {useNavStore} from '../../store/navStore';
import {useReciters} from '../../hooks/useReciters';
import {useDefaultReciter} from '../../hooks/useDefaultReciter';
import {useLovedSurahs} from '../../hooks/useLovedSurahs';
import {featuredFirst} from '../../services/browseCatalog';
import {removeContinue} from '../../services/continueListeningStore';
import {toggleLovedSurah} from '../../services/lovedSurahsStore';
import {playOrOpen, surahTitle} from '../../services/playbackRouting';
import {removePlaylistItem} from '../../services/playlistsStore';
import {showToast} from '../../store/toastStore';
import {
  HeartIcon,
  InfoRoundedIcon,
  PlayIcon,
  PlaylistIcon,
  TrashIcon,
} from '../../../components/Icons';
import {colors} from '../../theme/colors';
import {createScaledStyles} from '../../theme/scale';

/**
 * Long-press menu for a surah: play it, love it, add it to a playlist, go to
 * its reciter, and the actions of the place it was opened from (remove from
 * Continue listening or from a playlist).
 */
export function SurahContextMenu(): React.ReactElement | null {
  const target = useContextMenuStore(s =>
    s.target?.kind === 'surah' ? s.target : null,
  );
  const close = useContextMenuStore(s => s.close);
  const push = useNavStore(s => s.push);
  const {reciters} = useReciters();
  const {defaultReciterId} = useDefaultReciter();
  const loved = useLovedSurahs();

  // The voice the menu acts in: the one it was opened with, else the
  // default reciter, else the first featured.
  const reciter = useMemo(() => {
    const id = target?.reciterId ?? defaultReciterId;
    return (
      (id ? reciters.find(r => r.id === id) : undefined) ??
      featuredFirst(reciters)[0] ??
      null
    );
  }, [target?.reciterId, defaultReciterId, reciters]);

  if (!target) return null;
  const {surahNumber, rewayahId, origin} = target;
  const title = surahTitle(surahNumber);
  const isLoved = loved.some(e => e.surahNumber === surahNumber);
  const item = reciter
    ? {surahNumber, reciterId: reciter.id, ...(rewayahId ? {rewayahId} : {})}
    : null;

  function handlePlay(): void {
    close();
    if (!item) return;
    void playOrOpen({...item, source: 'surah-menu'});
  }

  function handleLove(): void {
    if (!item) return;
    const now = toggleLovedSurah(surahNumber, item.reciterId, rewayahId ?? '');
    showToast(now ? `Loved ${title}` : `Removed ${title} from loved`);
  }

  function handleAddToPlaylist(): void {
    if (!item) return;
    close();
    push({screen: 'playlistEdit', seed: item});
  }

  function handleReciter(): void {
    if (!reciter) return;
    close();
    push({screen: 'reciterDetail', reciterId: reciter.id});
  }

  function handleRemoveContinue(): void {
    if (!target?.reciterId) return;
    removeContinue(target.reciterId, surahNumber);
    close();
  }

  function handleRemoveFromPlaylist(): void {
    if (!target?.playlistId || !item) return;
    removePlaylistItem(target.playlistId, item);
    close();
  }

  return (
    <View style={menuStyles.scrim}>
      <View style={menuStyles.sheet}>
        <View style={menuStyles.header}>
          <View style={styles.art}>
            <SurahArtwork
              surahNumber={surahNumber}
              glyphSize={30}
              id={`surah-menu-${surahNumber}`}
            />
          </View>
          <View style={menuStyles.headerMeta}>
            <Text style={menuStyles.kicker}>{`SURAH ${surahNumber}`}</Text>
            <Text style={menuStyles.name} numberOfLines={1}>
              {title}
            </Text>
            {reciter ? (
              <Text style={styles.sub} numberOfLines={1}>
                {reciter.name}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={menuStyles.rows}>
          <MenuRow
            icon={<FocusIcon icon={PlayIcon} size={20} />}
            label="Play"
            onPress={handlePlay}
            hasTVPreferredFocus
          />
          <MenuRow
            icon={<FocusIcon icon={HeartIcon} size={20} filled={isLoved} />}
            label={isLoved ? 'Unlike' : 'Like'}
            onPress={handleLove}
          />
          <MenuRow
            icon={<FocusIcon icon={PlaylistIcon} size={20} />}
            label="Add to playlist"
            onPress={handleAddToPlaylist}
          />
          {reciter ? (
            <MenuRow
              icon={<FocusIcon icon={InfoRoundedIcon} size={20} />}
              label="Go to reciter"
              onPress={handleReciter}
            />
          ) : null}
          {origin === 'continue' && target.reciterId ? (
            <MenuRow
              icon={<FocusIcon icon={TrashIcon} size={20} />}
              label="Remove from Continue listening"
              onPress={handleRemoveContinue}
            />
          ) : null}
          {origin === 'playlist' && target.playlistId ? (
            <MenuRow
              icon={<FocusIcon icon={TrashIcon} size={20} />}
              label="Remove from playlist"
              onPress={handleRemoveFromPlaylist}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = createScaledStyles({
  art: {width: 96, height: 72, borderRadius: 16, overflow: 'hidden'},
  sub: {color: colors.textSecondary, fontSize: 15, fontWeight: '500'},
});
