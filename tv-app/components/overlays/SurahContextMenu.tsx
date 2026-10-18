import React, {useEffect, useMemo, useState} from 'react';
import {ScrollView, View} from 'react-native';
import {SurahArtwork} from '../brand/SurahArtwork';
import {FocusIcon} from '../primitives/focusContext';
import {ArrowDownIcon, ArrowUpIcon, PlusIcon} from '../library/LibraryIcons';
import {MenuRow, MenuSheet} from './MenuSheet';
import {
  useContextMenuStore,
  type SurahMenuTarget,
} from '../../store/contextMenuStore';
import {useNavStore} from '../../store/navStore';
import {useReciters} from '../../hooks/useReciters';
import {useDefaultReciter} from '../../hooks/useDefaultReciter';
import {useLovedSurahs} from '../../hooks/useLovedSurahs';
import {usePlaylist, usePlaylists} from '../../hooks/usePlaylists';
import {featuredFirst} from '../../services/browseCatalog';
import {
  getContinueListening,
  removeContinue,
} from '../../services/continueListeningStore';
import {isLovedIn, toggleLovedSurah} from '../../services/lovedSurahsStore';
import {surahMenuVoice} from '../../services/menuChoices';
import {playOrOpen, surahTitle} from '../../services/playbackRouting';
import {
  addPlaylistItem,
  movePlaylistItem,
  playlistHas,
  removePlaylistItem,
  type PlaylistItem,
} from '../../services/playlistsStore';
import {shortReciterName} from '../../services/listeningChoices';
import {pushScreenBack} from '../../services/screenBack';
import {getCachedRewayat} from '../../services/tvDataService';
import {showToast} from '../../store/toastStore';
import {
  CheckIcon,
  HeartIcon,
  InfoRoundedIcon,
  PlayIcon,
  PlaylistIcon,
  TrashIcon,
} from '../../../components/Icons';
import {colors} from '../../theme/colors';
import {createScaledStyles, scale} from '../../theme/scale';
import type {Reciter} from '../../types/reciter';

/**
 * Long-press menu for a surah: play it, love it, add it to a playlist, go to
 * its reciter, and the actions of the place it was opened from (remove from
 * Continue listening; move or remove a playlist row).
 */
export function SurahContextMenu(): React.ReactElement | null {
  const target = useContextMenuStore(s =>
    s.target?.kind === 'surah' ? s.target : null,
  );
  if (!target) return null;
  // A new menu starts on its first page; a moved playlist row keeps it.
  const key = [
    target.surahNumber,
    target.reciterId,
    target.rewayahId,
    target.origin,
    target.playlistId,
  ].join(':');
  return <SurahMenu key={key} target={target} />;
}

type Page = 'main' | 'playlists';

function SurahMenu({target}: {target: SurahMenuTarget}): React.ReactElement {
  const close = useContextMenuStore(s => s.close);
  const updateSurah = useContextMenuStore(s => s.updateSurah);
  const push = useNavStore(s => s.push);
  const {reciters} = useReciters();
  const {defaultReciterId} = useDefaultReciter();
  const loved = useLovedSurahs();
  const playlists = usePlaylists();
  const playlist = usePlaylist(target.playlistId);
  const [page, setPage] = useState<Page>(target.page ?? 'main');
  // Coming back from the playlist page, focus returns to the row that went.
  const [backToAdd, setBackToAdd] = useState<boolean>(false);

  const {surahNumber, origin} = target;
  const title = surahTitle(surahNumber);

  // The voice the menu acts in: the one it was opened with, else the
  // default reciter (or the first featured) who has the surah.
  const voice = useMemo<PlaylistItem | null>(() => {
    const candidates: Reciter[] = featuredFirst(reciters);
    const preferred = candidates.find(r => r.id === defaultReciterId);
    const ordered = preferred
      ? [preferred, ...candidates.filter(r => r !== preferred)]
      : candidates;
    return surahMenuVoice(
      target,
      ordered,
      r => getCachedRewayat(r.id) ?? r.rewayat ?? [],
    );
  }, [target, reciters, defaultReciterId]);
  const reciter = voice
    ? (reciters.find(r => r.id === voice.reciterId) ?? null)
    : null;
  const isLoved = voice
    ? isLovedIn(loved, surahNumber, voice.reciterId)
    : false;

  const index = target.playlistIndex ?? -1;
  const inPlaylist =
    origin === 'playlist' &&
    playlist !== null &&
    index >= 0 &&
    index < playlist.items.length;

  // Back on the playlist page returns to the first page, not out of the
  // menu (unless the menu opened on it).
  useEffect(() => {
    if (page !== 'playlists' || target.page === 'playlists') return;
    return pushScreenBack(() => {
      setBackToAdd(true);
      setPage('main');
      return true;
    });
  }, [page, target.page]);

  function handlePlay(): void {
    close({restoreFocus: false});
    if (inPlaylist && playlist) {
      // The playlist from this row on, like OK on the row.
      void playOrOpen({
        ...playlist.items[index],
        queue: playlist.items,
        source: 'playlist',
      });
      return;
    }
    if (!voice) {
      showToast(`No reciter has ${title} yet.`, 'error');
      return;
    }
    const resume =
      origin === 'continue'
        ? getContinueListening().find(
            e =>
              e.reciterId === voice.reciterId && e.surahNumber === surahNumber,
          )
        : undefined;
    void playOrOpen({
      ...voice,
      ...(resume ? {startSeconds: resume.positionSeconds} : {}),
      source: 'surah-menu',
    });
  }

  function handleLove(): void {
    if (!voice) return;
    toggleLovedSurah(surahNumber, voice.reciterId, voice.rewayahId ?? '');
  }

  function handleReciter(): void {
    if (!reciter) return;
    close({restoreFocus: false});
    push({screen: 'reciterDetail', reciterId: reciter.id});
  }

  function handleRemoveContinue(): void {
    if (!target.reciterId) return;
    removeContinue(target.reciterId, surahNumber);
    close();
  }

  function move(by: -1 | 1): void {
    if (!inPlaylist || !playlist || !target.playlistId) return;
    const to = index + by;
    if (to < 0 || to >= playlist.items.length) return;
    movePlaylistItem(target.playlistId, index, to);
    // The menu stays open on the row, now at its new place.
    updateSurah({playlistIndex: to});
  }

  function handleRemoveFromPlaylist(): void {
    if (!inPlaylist || !target.playlistId) return;
    removePlaylistItem(target.playlistId, index);
    // The row is gone: the playlist screen focuses its neighbour.
    close({restoreFocus: false});
  }

  function handleNewPlaylist(): void {
    if (!voice) return;
    close({restoreFocus: false});
    push({screen: 'playlistEdit', seed: voice});
  }

  function toggleIn(id: string, name: string, has: boolean): void {
    if (!voice) return;
    if (has) {
      removePlaylistItem(id, voice);
      return;
    }
    if (!addPlaylistItem(id, voice)) showToast(`${name} is full.`, 'error');
  }

  const art = (
    <View style={styles.art}>
      <SurahArtwork
        surahNumber={surahNumber}
        glyphSize={34}
        id={`surah-menu-${surahNumber}`}
      />
    </View>
  );
  const subtitle = reciter ? reciter.name : undefined;

  if (page === 'playlists') {
    return (
      <MenuSheet
        art={art}
        kicker="ADD TO PLAYLIST"
        title={title}
        subtitle={reciter ? shortReciterName(reciter.name) : undefined}>
        <MenuRow
          icon={<FocusIcon icon={PlusIcon} size={24} />}
          label="New playlist…"
          onPress={handleNewPlaylist}
          hasTVPreferredFocus
        />
        {playlists.length > 0 ? (
          <ScrollView
            style={styles.pickList}
            contentContainerStyle={styles.pickContent}
            showsVerticalScrollIndicator={false}>
            {playlists.map(p => {
              const has = voice !== null && playlistHas(p, voice);
              return (
                <MenuRow
                  key={p.id}
                  icon={<FocusIcon icon={PlaylistIcon} size={24} />}
                  label={p.name}
                  accessibilityLabel={
                    has ? `${p.name}, added. Remove` : `Add to ${p.name}`
                  }
                  onPress={() => toggleIn(p.id, p.name, has)}
                  trailing={
                    has ? (
                      <CheckIcon color={colors.accent} size={scale(24)} />
                    ) : null
                  }
                />
              );
            })}
          </ScrollView>
        ) : null}
      </MenuSheet>
    );
  }

  return (
    <MenuSheet
      art={art}
      kicker={`SURAH ${surahNumber}`}
      title={title}
      subtitle={subtitle}>
      <MenuRow
        icon={<FocusIcon icon={PlayIcon} size={24} />}
        label={
          inPlaylist
            ? 'Play from here'
            : origin === 'continue'
              ? 'Resume'
              : 'Play'
        }
        onPress={handlePlay}
        hasTVPreferredFocus={!backToAdd}
      />
      {voice ? (
        <MenuRow
          icon={<FocusIcon icon={HeartIcon} size={24} filled={isLoved} />}
          label={isLoved ? 'Unlike' : 'Like'}
          accessibilityLabel={
            isLoved ? `Unlike ${title}` : `Like ${title} in this voice`
          }
          onPress={handleLove}
        />
      ) : null}
      {voice ? (
        <MenuRow
          icon={<FocusIcon icon={PlaylistIcon} size={24} />}
          label="Add to playlist…"
          onPress={() => setPage('playlists')}
          hasTVPreferredFocus={backToAdd}
        />
      ) : null}
      {inPlaylist && playlist ? (
        <>
          {/* Both stay in place at the ends, so focus never loses its row. */}
          <MenuRow
            icon={
              <FocusIcon
                icon={ArrowUpIcon}
                size={24}
                color={index > 0 ? colors.text : colors.textTertiary}
              />
            }
            label="Move up"
            onPress={() => move(-1)}
          />
          <MenuRow
            icon={
              <FocusIcon
                icon={ArrowDownIcon}
                size={24}
                color={
                  index < playlist.items.length - 1
                    ? colors.text
                    : colors.textTertiary
                }
              />
            }
            label="Move down"
            onPress={() => move(1)}
          />
          <MenuRow
            icon={<FocusIcon icon={TrashIcon} size={24} />}
            label="Remove from playlist"
            onPress={handleRemoveFromPlaylist}
          />
        </>
      ) : null}
      {reciter && origin !== 'reciter' ? (
        <MenuRow
          icon={<FocusIcon icon={InfoRoundedIcon} size={24} />}
          label="Go to reciter"
          onPress={handleReciter}
        />
      ) : null}
      {origin === 'continue' && target.reciterId ? (
        <MenuRow
          icon={<FocusIcon icon={TrashIcon} size={24} />}
          label="Remove from Continue listening"
          onPress={handleRemoveContinue}
        />
      ) : null}
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
  // Long lists scroll inside the sheet; focus scrolls them.
  pickList: {maxHeight: 420},
  pickContent: {gap: 4},
});
