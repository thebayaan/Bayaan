import React, {useMemo} from 'react';
import {ScrollView, Text, TVFocusGuideView, View} from 'react-native';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusIcon, FocusText} from '../components/primitives/focusContext';
import {usePlaylist} from '../hooks/usePlaylists';
import {useReciters} from '../hooks/useReciters';
import {playOrOpen, surahTitle} from '../services/playbackRouting';
import type {PlaylistItem} from '../services/playlistsStore';
import {useNavStore} from '../store/navStore';
import {PlayIcon, ShuffleIcon} from '../../components/Icons';
import {colors} from '../theme/colors';
import {fonts} from '../theme/typography';
import {spacing} from '../theme/spacing';
import {createScaledStyles} from '../theme/scale';

type Props = {playlistId: string};

/**
 * One playlist: Play / Shuffle / Edit, then its surahs in order. OK on a
 * surah plays the playlist from there.
 */
export function PlaylistScreen({playlistId}: Props): React.ReactElement {
  const playlist = usePlaylist(playlistId);
  const {reciters} = useReciters();
  const push = useNavStore(s => s.push);
  const pop = useNavStore(s => s.pop);

  const reciterNames = useMemo(
    () => new Map(reciters.map(r => [r.id, r.name])),
    [reciters],
  );

  if (!playlist) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.title}>Playlist not found</Text>
        <Text style={styles.sub}>It may have been deleted.</Text>
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

  const items = playlist.items;

  function play(from: PlaylistItem, shuffle = false): void {
    void playOrOpen({...from, queue: items, shuffle, source: 'playlist'});
  }

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>PLAYLIST</Text>
      <Text style={styles.title} numberOfLines={1}>
        {playlist.name}
      </Text>
      <Text style={styles.sub}>
        {items.length === 1 ? '1 surah' : `${items.length} surahs`}
      </Text>
      <TVFocusGuideView autoFocus style={styles.actions}>
        {items.length > 0 ? (
          <>
            <FocusableButton
              onPress={() => play(items[0])}
              accessibilityLabel="Play playlist"
              hasTVPreferredFocus
              outlined
              style={styles.btn}>
              <View style={styles.btnInner}>
                <FocusIcon icon={PlayIcon} size={20} />
                <FocusText style={styles.btnText}>Play</FocusText>
              </View>
            </FocusableButton>
            {items.length > 1 ? (
              <FocusableButton
                onPress={() =>
                  play(items[Math.floor(Math.random() * items.length)], true)
                }
                accessibilityLabel="Shuffle playlist"
                style={styles.btn}>
                <View style={styles.btnInner}>
                  <FocusIcon icon={ShuffleIcon} size={20} />
                  <FocusText style={styles.btnText}>Shuffle</FocusText>
                </View>
              </FocusableButton>
            ) : null}
          </>
        ) : null}
        <FocusableButton
          onPress={() => push({screen: 'playlistEdit', playlistId})}
          accessibilityLabel="Edit playlist"
          hasTVPreferredFocus={items.length === 0}
          style={styles.btn}>
          <FocusText style={styles.btnText}>Edit</FocusText>
        </FocusableButton>
      </TVFocusGuideView>
      {items.length === 0 ? (
        <Text style={styles.empty}>
          Long-press a surah anywhere and choose Add to playlist.
        </Text>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.map((item, i) => (
            <FocusableButton
              key={`${item.reciterId}:${item.rewayahId ?? ''}:${item.surahNumber}`}
              onPress={() => play(item)}
              accessibilityLabel={`Play ${surahTitle(item.surahNumber)}`}
              style={styles.row}>
              <View style={styles.rowInner}>
                <FocusText style={styles.rowNum}>{`${i + 1}`}</FocusText>
                <FocusText style={styles.rowTitle}>
                  {surahTitle(item.surahNumber)}
                </FocusText>
                <FocusText style={styles.rowSub}>
                  {reciterNames.get(item.reciterId) ?? ''}
                </FocusText>
              </View>
            </FocusableButton>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = createScaledStyles({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 72,
    paddingHorizontal: 96,
  },
  center: {alignItems: 'center', justifyContent: 'center', gap: spacing.md},
  kicker: {
    color: colors.accent,
    fontFamily: fonts.extraBold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 8,
  },
  sub: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 20,
    fontWeight: '500',
    marginTop: 6,
  },
  actions: {flexDirection: 'row', gap: 14, marginTop: 28, marginBottom: 28},
  btn: {paddingHorizontal: 26, paddingVertical: 14, borderRadius: 16},
  btnInner: {flexDirection: 'row', alignItems: 'center', gap: 10},
  btnText: {fontFamily: fonts.bold, fontSize: 19, fontWeight: '700'},
  empty: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 20,
    fontWeight: '500',
  },
  list: {gap: 6, paddingBottom: 96},
  row: {paddingHorizontal: 20, paddingVertical: 16, borderRadius: 16},
  rowInner: {flexDirection: 'row', alignItems: 'center', gap: 24},
  rowNum: {
    width: 40,
    fontFamily: fonts.semiBold,
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.6,
  },
  rowTitle: {flex: 1, fontFamily: fonts.bold, fontSize: 22, fontWeight: '700'},
  rowSub: {fontFamily: fonts.medium, fontSize: 18, fontWeight: '500'},
});
