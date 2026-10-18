import {FlashList} from '@shopify/flash-list';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Text, TVFocusGuideView, View} from 'react-native';
import {GradientFill} from '../components/brand/GradientFill';
import {SurahGlyph} from '../components/brand/SurahGlyph';
import {PencilIcon} from '../components/library/LibraryIcons';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusIcon, FocusText} from '../components/primitives/focusContext';
import {usePlaylist} from '../hooks/usePlaylists';
import {useReciters} from '../hooks/useReciters';
import {rewayahFamily, rewayahShortName} from '../services/browseCatalog';
import {cellHeightLayout} from '../components/browse/gridLayout';
import {playlistCaption} from '../services/libraryShelf';
import {shortReciterName} from '../services/listeningChoices';
import {playOrOpen, surahTitle} from '../services/playbackRouting';
import {playlistGradient} from '../services/playlistFormat';
import {claimFocusReturn} from '../services/focusReturn';
import {
  getPlaylist,
  removePlaylist,
  type PlaylistItem,
} from '../services/playlistsStore';
import {getCachedRewayat} from '../services/tvDataService';
import {useContextMenuStore} from '../store/contextMenuStore';
import {useNavStore} from '../store/navStore';
import {showToast} from '../store/toastStore';
import {
  PlaylistIcon,
  PlayIcon,
  ShuffleIcon,
  TrashIcon,
} from '../../components/Icons';
import {colors} from '../theme/colors';
import {fonts} from '../theme/typography';
import {createScaledStyles, scale} from '../theme/scale';
import type {Reciter} from '../types/reciter';

type Props = {playlistId: string};

const ROW_HEIGHT = 96;
/** For Vega's FlashList (see cellHeightLayout). */
const rowLayout = cellHeightLayout(ROW_HEIGHT);
const ART = 300;
/** How long the Delete button waits for its second press. */
const CONFIRM_MS = 4000;

// The row last played from, per playlist, so Back from the player lands on
// it rather than on Play.
const lastRow = new Map<string, number>();

function itemKey(item: PlaylistItem): string {
  return `${item.surahNumber}:${item.reciterId}:${item.rewayahId ?? ''}`;
}

/**
 * One playlist. On the left its art, name and actions (Play, Shuffle,
 * Rename, Delete); on the right its surahs in order. OK on a row plays the
 * playlist from there; holding OK opens the row's menu (play from here,
 * like, add to another playlist, move up or down, remove).
 */
export function PlaylistScreen({playlistId}: Props): React.ReactElement {
  const playlist = usePlaylist(playlistId);
  const {reciters} = useReciters();
  const push = useNavStore(s => s.push);
  const pop = useNavStore(s => s.pop);
  const switchTab = useNavStore(s => s.switchTab);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  const reciterById = useMemo(
    () => new Map<string, Reciter>(reciters.map(r => [r.id, r])),
    [reciters],
  );
  const voiceOf = useCallback(
    (id: string): string => {
      const reciter = reciterById.get(id);
      return reciter ? shortReciterName(reciter.name) : '';
    },
    [reciterById],
  );

  const items = useMemo(() => playlist?.items ?? [], [playlist]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Which row takes focus: the one played from last (coming back from the
  // player), or after a row's menu closes, that row (moved) or the one now
  // in its place (removed). Dropped once it has landed.
  const [focusRow, setFocusRow] = useState<number | null>(() => {
    const row = lastRow.get(playlistId);
    return row !== undefined && row < items.length ? row : null;
  });
  const initialRow = useRef<number | null>(focusRow).current;
  useEffect(() => {
    if (focusRow === null) return;
    const timer = setTimeout(() => setFocusRow(null), 1500);
    return () => clearTimeout(timer);
  }, [focusRow]);

  useEffect(() => {
    let openedAt: number | null = null;
    let menuRow: number | null = null;
    return useContextMenuStore.subscribe(next => {
      const t = next.target;
      if (
        t?.kind === 'surah' &&
        t.origin === 'playlist' &&
        t.playlistId === playlistId
      ) {
        openedAt ??= t.playlistIndex ?? null;
        menuRow = t.playlistIndex ?? null;
        return;
      }
      if (t === null && menuRow !== null) {
        // Read the store, not the last render: a removal has only just
        // been written.
        const count = getPlaylist(playlistId)?.items.length ?? 0;
        const before = itemsRef.current.length;
        // A row that stayed put gets focus back from the menu itself; a
        // moved or removed one is placed here, since a recycled cell may
        // now show another surah.
        if (count > 0 && (menuRow !== openedAt || count !== before)) {
          setFocusRow(Math.min(menuRow, count - 1));
          claimFocusReturn();
        }
        openedAt = null;
        menuRow = null;
      }
    });
  }, [playlistId]);

  // The second press of Delete must come soon after the first.
  useEffect(() => {
    if (!confirmDelete) return;
    const timer = setTimeout(() => setConfirmDelete(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirmDelete]);

  const playFrom = useCallback(
    (index: number, shuffle = false): void => {
      const list = itemsRef.current;
      const from = list[index];
      if (!from) return;
      if (!shuffle) lastRow.set(playlistId, index);
      void playOrOpen({
        ...from,
        queue: list,
        ...(shuffle ? {shuffle: true} : {}),
        source: 'playlist',
      });
    },
    [playlistId],
  );

  const renderItem = useCallback(
    ({item, index}: {item: PlaylistItem; index: number}) => {
      const reciter = reciterById.get(item.reciterId);
      const rewayah = (
        getCachedRewayat(item.reciterId) ??
        reciter?.rewayat ??
        []
      ).find(r => r.id === item.rewayahId);
      const voice = voiceOf(item.reciterId);
      const sub = [
        voice,
        rewayah && rewayahFamily(rewayah.name) !== 'hafs'
          ? rewayahShortName(rewayah.name)
          : '',
      ]
        .filter(Boolean)
        .join(' · ');
      const title = surahTitle(item.surahNumber);
      return (
        <View style={styles.cell}>
          <FocusableButton
            onPress={() => playFrom(index)}
            onLongPress={() =>
              useContextMenuStore.getState().openSurah({
                surahNumber: item.surahNumber,
                reciterId: item.reciterId,
                ...(item.rewayahId ? {rewayahId: item.rewayahId} : {}),
                origin: 'playlist',
                playlistId,
                playlistIndex: index,
              })
            }
            hasTVPreferredFocus={focusRow === index}
            accessibilityLabel={`${index + 1}. ${title}${
              voice ? `, ${voice}` : ''
            }. Hold OK for more`}
            focusScale={1.02}
            containerStyle={styles.rowWrap}
            style={styles.row}>
            <View style={styles.rowInner}>
              <FocusText
                style={styles.rowNum}
                color={colors.textTertiary}
                focusedColor={colors.onFocusSecondary}>
                {`${index + 1}`}
              </FocusText>
              <View style={styles.rowText}>
                <FocusText style={styles.rowTitle} numberOfLines={1}>
                  {title}
                </FocusText>
                {sub ? (
                  <FocusText
                    style={styles.rowSub}
                    numberOfLines={1}
                    color={colors.textSecondary}
                    focusedColor={colors.onFocusSecondary}>
                    {sub}
                  </FocusText>
                ) : null}
              </View>
            </View>
          </FocusableButton>
        </View>
      );
    },
    [reciterById, voiceOf, playFrom, focusRow, playlistId],
  );

  if (!playlist) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.name}>Playlist not found</Text>
        <Text style={styles.caption}>It may have been deleted.</Text>
        <FocusableButton
          onPress={pop}
          accessibilityLabel="Go back"
          hasTVPreferredFocus
          outlined
          style={styles.btn}>
          <FocusText style={styles.btnText}>Go back</FocusText>
        </FocusableButton>
      </View>
    );
  }

  const hasItems = items.length > 0;

  function remove(): void {
    if (!playlist) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    removePlaylist(playlist.id);
    lastRow.delete(playlist.id);
    showToast(`Deleted ${playlist.name}`);
    pop();
  }

  return (
    <View style={styles.container}>
      <View style={styles.side}>
        <View style={styles.art}>
          <GradientFill
            colors={playlistGradient(playlist.color)}
            id={`playlist-art-${playlist.id}`}
          />
          <View style={styles.artGlyph}>
            {hasItems ? (
              <SurahGlyph surahNumber={items[0].surahNumber} size={120} />
            ) : (
              <PlaylistIcon color={colors.textSecondary} size={scale(80)} />
            )}
          </View>
        </View>
        <Text style={styles.kicker}>PLAYLIST</Text>
        <Text style={styles.name} numberOfLines={2}>
          {playlist.name}
        </Text>
        <Text style={styles.caption} numberOfLines={1}>
          {playlistCaption(items, voiceOf)}
        </Text>
        <TVFocusGuideView autoFocus trapFocusLeft style={styles.actions}>
          {hasItems ? (
            <View style={styles.actionRow}>
              <FocusableButton
                onPress={() => playFrom(0)}
                accessibilityLabel={`Play ${playlist.name}`}
                hasTVPreferredFocus={initialRow === null}
                outlined
                style={styles.btn}>
                <View style={styles.btnInner}>
                  <FocusIcon icon={PlayIcon} size={22} />
                  <FocusText style={styles.btnText}>Play</FocusText>
                </View>
              </FocusableButton>
              {items.length > 1 ? (
                <FocusableButton
                  onPress={() =>
                    playFrom(Math.floor(Math.random() * items.length), true)
                  }
                  accessibilityLabel={`Shuffle ${playlist.name}`}
                  style={styles.btn}>
                  <View style={styles.btnInner}>
                    <FocusIcon icon={ShuffleIcon} size={22} />
                    <FocusText style={styles.btnText}>Shuffle</FocusText>
                  </View>
                </FocusableButton>
              ) : null}
            </View>
          ) : null}
          <View style={styles.actionRow}>
            <FocusableButton
              onPress={() => push({screen: 'playlistEdit', playlistId})}
              accessibilityLabel="Rename playlist"
              style={styles.btn}>
              <View style={styles.btnInner}>
                <FocusIcon icon={PencilIcon} size={22} />
                <FocusText style={styles.btnText}>Rename</FocusText>
              </View>
            </FocusableButton>
            <FocusableButton
              onPress={remove}
              accessibilityLabel={
                confirmDelete
                  ? `Press again to delete ${playlist.name}`
                  : 'Delete playlist'
              }
              style={styles.btn}>
              <View style={styles.btnInner}>
                <FocusIcon icon={TrashIcon} size={22} />
                <FocusText style={styles.btnText}>
                  {confirmDelete ? 'Press again to delete' : 'Delete'}
                </FocusText>
              </View>
            </FocusableButton>
          </View>
        </TVFocusGuideView>
      </View>

      {hasItems ? (
        <TVFocusGuideView
          autoFocus
          trapFocusUp
          trapFocusDown
          trapFocusRight
          style={styles.list}>
          <FlashList
            data={items}
            renderItem={renderItem}
            keyExtractor={itemKey}
            overrideItemLayout={rowLayout}
            extraData={focusRow}
            initialScrollIndex={
              initialRow !== null && initialRow > 0 ? initialRow : undefined
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </TVFocusGuideView>
      ) : (
        <TVFocusGuideView autoFocus style={styles.empty}>
          <Text style={styles.emptyTitle}>No surahs yet</Text>
          <Text style={styles.emptyText}>
            Hold OK on any surah and choose Add to playlist.
          </Text>
          <FocusableButton
            onPress={() => switchTab('surahs')}
            accessibilityLabel="Browse surahs"
            hasTVPreferredFocus
            outlined
            style={[styles.btn, styles.emptyButton]}>
            <FocusText style={styles.btnText}>Browse surahs</FocusText>
          </FocusableButton>
        </TVFocusGuideView>
      )}
    </View>
  );
}

const styles = createScaledStyles({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
    paddingTop: 96,
    paddingLeft: 96,
    paddingRight: 84,
    gap: 72,
  },
  center: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 0,
  },
  side: {width: 560},
  art: {
    width: ART,
    height: ART,
    borderRadius: 28,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  artGlyph: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  kicker: {
    color: colors.textTertiary,
    fontFamily: fonts.extraBold,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 36,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 54,
    fontWeight: '700',
    letterSpacing: -1.2,
    marginTop: 8,
  },
  caption: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 22,
    fontWeight: '500',
    marginTop: 8,
  },
  actions: {marginTop: 32, gap: 12, alignSelf: 'flex-start'},
  actionRow: {flexDirection: 'row', gap: 12},
  btn: {paddingHorizontal: 26, paddingVertical: 14, borderRadius: 16},
  btnInner: {flexDirection: 'row', alignItems: 'center', gap: 12},
  btnText: {fontFamily: fonts.bold, fontSize: 22, fontWeight: '700'},
  list: {flex: 1},
  listContent: {paddingBottom: 120},
  cell: {height: ROW_HEIGHT, paddingVertical: 4},
  rowWrap: {flex: 1},
  row: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  rowInner: {flexDirection: 'row', alignItems: 'center', gap: 24},
  rowNum: {
    width: 44,
    fontFamily: fonts.semiBold,
    fontSize: 20,
    fontWeight: '600',
  },
  rowText: {flex: 1, gap: 2},
  rowTitle: {fontFamily: fonts.bold, fontSize: 26, fontWeight: '700'},
  rowSub: {fontFamily: fonts.medium, fontSize: 19, fontWeight: '500'},
  empty: {flex: 1, gap: 18, paddingTop: 8},
  emptyTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 34,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 24,
    fontWeight: '500',
    lineHeight: 34,
  },
  emptyButton: {alignSelf: 'flex-start', marginTop: 12},
});
