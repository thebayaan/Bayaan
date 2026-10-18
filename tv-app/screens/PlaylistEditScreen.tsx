import React, {useState} from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TVFocusGuideView,
  View,
} from 'react-native';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusText} from '../components/primitives/focusContext';
import {usePlaylist, usePlaylists} from '../hooks/usePlaylists';
import {surahTitle} from '../services/playbackRouting';
import {
  addPlaylistItem,
  cleanPlaylistName,
  createPlaylist,
  removePlaylist,
  renamePlaylist,
  type PlaylistItem,
} from '../services/playlistsStore';
import {useNavStore} from '../store/navStore';
import {showToast} from '../store/toastStore';
import {colors} from '../theme/colors';
import {fonts} from '../theme/typography';
import {createScaledStyles} from '../theme/scale';

type Props = {
  /** Rename / delete this playlist; without it a new one is made. */
  playlistId?: string;
  /** A surah to add: to an existing playlist, or to the new one. */
  seed?: PlaylistItem;
};

/**
 * Create, rename or delete a playlist. Opened with a surah (from a surah's
 * menu) it first offers the existing playlists to add it to.
 */
export function PlaylistEditScreen({
  playlistId,
  seed,
}: Props): React.ReactElement {
  const existing = usePlaylist(playlistId);
  const playlists = usePlaylists();
  const pop = useNavStore(s => s.pop);
  const [name, setName] = useState<string>(existing?.name ?? '');

  function addTo(id: string, listName: string): void {
    if (!seed) return;
    const added = addPlaylistItem(id, seed);
    showToast(
      added
        ? `Added ${surahTitle(seed.surahNumber)} to ${listName}`
        : `${surahTitle(seed.surahNumber)} is already in ${listName}`,
    );
    pop();
  }

  function save(): void {
    if (existing) {
      renamePlaylist(existing.id, name);
    } else {
      createPlaylist(name, seed ? [seed] : []);
      showToast(`Created ${cleanPlaylistName(name)}`);
    }
    pop();
  }

  function remove(): void {
    if (!existing) return;
    removePlaylist(existing.id);
    showToast(`Deleted ${existing.name}`);
    pop();
    // Its page, when under this one, has nothing left to show: leave it too.
    const {stack} = useNavStore.getState();
    const below = stack[stack.length - 1];
    if (below?.screen === 'playlist' && below.playlistId === existing.id) pop();
  }

  const heading = existing
    ? 'Edit playlist'
    : seed
      ? `Add ${surahTitle(seed.surahNumber)} to a playlist`
      : 'New playlist';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{heading}</Text>
      {!existing && seed && playlists.length > 0 ? (
        <TVFocusGuideView autoFocus style={styles.section}>
          <Text style={styles.label}>YOUR PLAYLISTS</Text>
          {playlists.map((p, i) => (
            <FocusableButton
              key={p.id}
              onPress={() => addTo(p.id, p.name)}
              accessibilityLabel={`Add to ${p.name}`}
              hasTVPreferredFocus={i === 0}
              style={styles.row}>
              <FocusText style={styles.rowText}>{p.name}</FocusText>
            </FocusableButton>
          ))}
        </TVFocusGuideView>
      ) : null}
      <View style={styles.section}>
        <Text style={styles.label}>
          {existing ? 'NAME' : 'NEW PLAYLIST NAME'}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="My playlist"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={save}
          hasTVPreferredFocus={existing !== null || playlists.length === 0}
        />
      </View>
      <TVFocusGuideView autoFocus style={styles.actions}>
        <FocusableButton
          onPress={save}
          accessibilityLabel={existing ? 'Save' : 'Create playlist'}
          outlined
          style={styles.btn}>
          <FocusText style={styles.btnText}>
            {existing ? 'Save' : 'Create playlist'}
          </FocusText>
        </FocusableButton>
        {existing ? (
          <FocusableButton
            onPress={remove}
            accessibilityLabel="Delete playlist"
            style={styles.btn}>
            <FocusText style={styles.btnText}>Delete playlist</FocusText>
          </FocusableButton>
        ) : null}
        <FocusableButton
          onPress={pop}
          accessibilityLabel="Cancel"
          style={styles.btn}>
          <FocusText style={styles.btnText}>Cancel</FocusText>
        </FocusableButton>
      </TVFocusGuideView>
    </ScrollView>
  );
}

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: colors.background},
  content: {paddingTop: 72, paddingHorizontal: 96, paddingBottom: 96},
  title: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  section: {marginTop: 36, gap: 8, maxWidth: 900},
  label: {
    color: colors.accent,
    fontFamily: fonts.extraBold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.4,
    marginBottom: 6,
  },
  row: {paddingHorizontal: 20, paddingVertical: 16, borderRadius: 16},
  rowText: {fontFamily: fonts.bold, fontSize: 22, fontWeight: '700'},
  input: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 24,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 2,
    borderColor: colors.outline,
  },
  actions: {flexDirection: 'row', gap: 14, marginTop: 36},
  btn: {paddingHorizontal: 26, paddingVertical: 14, borderRadius: 16},
  btnText: {fontFamily: fonts.bold, fontSize: 19, fontWeight: '700'},
});
