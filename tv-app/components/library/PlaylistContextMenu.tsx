import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {View} from 'react-native';
import {GradientFill} from '../brand/GradientFill';
import {SurahGlyph} from '../brand/SurahGlyph';
import {MenuRow, MenuSheet} from '../overlays/MenuSheet';
import {FocusIcon} from '../primitives/focusContext';
import {FocusWatch} from './FocusWatch';
import {PencilIcon} from './LibraryIcons';
import {usePlaylist} from '../../hooks/usePlaylists';
import {useReciters} from '../../hooks/useReciters';
import {playlistCaption} from '../../services/libraryShelf';
import {shortReciterName} from '../../services/listeningChoices';
import {playOrOpen} from '../../services/playbackRouting';
import {playlistGradient} from '../../services/playlistFormat';
import {removePlaylist} from '../../services/playlistsStore';
import {useContextMenuStore} from '../../store/contextMenuStore';
import {useNavStore} from '../../store/navStore';
import {showToast} from '../../store/toastStore';
import {
  PlaylistIcon,
  PlayIcon,
  ShuffleIcon,
  TrashIcon,
} from '../../../components/Icons';
import {colors} from '../../theme/colors';
import {createScaledStyles, scale} from '../../theme/scale';

/** How long Delete waits for its second press (as on the playlist page). */
const CONFIRM_MS = 4000;

/**
 * Long-press menu for a playlist tile: play or shuffle it, rename it, or
 * delete it (two presses, like the playlist page), without opening it.
 */
export function PlaylistContextMenu(): React.ReactElement | null {
  const playlistId = useContextMenuStore(s =>
    s.target?.kind === 'playlist' ? s.target.playlistId : null,
  );
  if (!playlistId) return null;
  return <PlaylistMenu key={playlistId} playlistId={playlistId} />;
}

function PlaylistMenu({playlistId}: {playlistId: string}): React.ReactElement {
  const playlist = usePlaylist(playlistId);
  const {reciters} = useReciters();
  const close = useContextMenuStore(s => s.close);
  const push = useNavStore(s => s.push);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  const voiceOf = useMemo(() => {
    const names = new Map(reciters.map(r => [r.id, r.name]));
    return (id: string): string => {
      const name = names.get(id);
      return name ? shortReciterName(name) : '';
    };
  }, [reciters]);

  // The second press of Delete must come soon after the first, and on the
  // same row: leaving it disarms it.
  useEffect(() => {
    if (!confirmDelete) return;
    const timer = setTimeout(() => setConfirmDelete(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirmDelete]);
  const onDeleteFocus = useCallback((focused: boolean): void => {
    if (!focused) setConfirmDelete(false);
  }, []);

  // Deleted from elsewhere while open: nothing left to act on.
  useEffect(() => {
    if (!playlist) close({restoreFocus: false});
  }, [playlist, close]);
  if (!playlist) return <View />;

  const items = playlist.items;

  function play(shuffle: boolean): void {
    const from = shuffle ? Math.floor(Math.random() * items.length) : 0;
    if (!items[from]) return;
    close({restoreFocus: false});
    void playOrOpen({
      ...items[from],
      queue: items,
      ...(shuffle ? {shuffle: true} : {}),
      source: 'playlist',
    });
  }

  function rename(): void {
    close({restoreFocus: false});
    push({screen: 'playlistEdit', playlistId});
  }

  function remove(): void {
    if (!playlist) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    removePlaylist(playlist.id);
    showToast(`Deleted ${playlist.name}`);
    // The tile is gone: the Library focuses the one now in its place.
    close();
  }

  const art = (
    <View style={styles.art}>
      <GradientFill
        colors={playlistGradient(playlist.color)}
        id={`playlist-menu-${playlist.id}`}
      />
      <View style={styles.artGlyph}>
        {items[0] ? (
          <SurahGlyph
            surahNumber={items[0].surahNumber}
            size={34}
            fitWidth={72}
          />
        ) : (
          <PlaylistIcon color={colors.textSecondary} size={scale(36)} />
        )}
      </View>
    </View>
  );

  return (
    <MenuSheet
      art={art}
      kicker="PLAYLIST"
      title={playlist.name}
      subtitle={playlistCaption(items, voiceOf)}>
      {items.length > 0 ? (
        <MenuRow
          icon={<FocusIcon icon={PlayIcon} size={24} />}
          label="Play"
          accessibilityLabel={`Play ${playlist.name}`}
          onPress={() => play(false)}
          hasTVPreferredFocus
        />
      ) : null}
      {items.length > 1 ? (
        <MenuRow
          icon={<FocusIcon icon={ShuffleIcon} size={24} />}
          label="Shuffle"
          accessibilityLabel={`Shuffle ${playlist.name}`}
          onPress={() => play(true)}
        />
      ) : null}
      <MenuRow
        icon={<FocusIcon icon={PencilIcon} size={24} />}
        label="Rename"
        accessibilityLabel={`Rename ${playlist.name}`}
        onPress={rename}
        hasTVPreferredFocus={items.length === 0}
      />
      <MenuRow
        icon={
          <>
            <FocusWatch onChange={onDeleteFocus} />
            <FocusIcon icon={TrashIcon} size={24} />
          </>
        }
        label={confirmDelete ? 'Press again to delete' : 'Delete playlist'}
        accessibilityLabel={
          confirmDelete
            ? `Press again to delete ${playlist.name}`
            : `Delete ${playlist.name}`
        }
        onPress={remove}
      />
    </MenuSheet>
  );
}

const styles = createScaledStyles({
  art: {
    width: 88,
    height: 88,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  artGlyph: {flex: 1, alignItems: 'center', justifyContent: 'center'},
});
