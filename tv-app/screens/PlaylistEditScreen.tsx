import React, {useState} from 'react';
import {Text, TVFocusGuideView, View} from 'react-native';
import {GradientFill} from '../components/brand/GradientFill';
import {SurahGlyph} from '../components/brand/SurahGlyph';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusableCard} from '../components/primitives/FocusableCard';
import {FocusFrame, FocusText} from '../components/primitives/focusContext';
import {SearchKeyboard} from '../components/search/SearchKeyboard';
import {usePlaylist, usePlaylists} from '../hooks/usePlaylists';
import {useReciters} from '../hooks/useReciters';
import {shortReciterName} from '../services/listeningChoices';
import {surahTitle} from '../services/playbackRouting';
import {
  FALLBACK_PLAYLIST_COLOR,
  PLAYLIST_COLORS,
  draftDelete,
  draftKey,
  draftSpace,
  nextPlaylistColor,
  nextPlaylistName,
  playlistGradient,
  type NameDraft,
} from '../services/playlistFormat';
import {
  cleanPlaylistName,
  createPlaylist,
  renamePlaylist,
  setPlaylistColor,
  type PlaylistItem,
} from '../services/playlistsStore';
import {nextMode, type KeyboardMode} from '../services/search/keyboard';
import {useNavStore} from '../store/navStore';
import {showToast} from '../store/toastStore';
import {CheckIcon, PlaylistIcon} from '../../components/Icons';
import {colors} from '../theme/colors';
import {fonts} from '../theme/typography';
import {createScaledStyles, scale} from '../theme/scale';

type Props = {
  /** Rename this playlist; without it a new one is made. */
  playlistId?: string;
  /** The surah a new playlist starts with (from a surah's menu). */
  seed?: PlaylistItem;
};

const SWATCH = 64;
const PREVIEW = 260;

/**
 * Name a new playlist (or rename one) on the grid keyboard and pick its
 * colour. The name comes prefilled ("Playlist 3") so Save works at once; the
 * first key replaces it. Right from the keyboard lands on Save. Back
 * cancels. A playlist made from the Library opens straight away; one made
 * from a surah's menu takes that surah and returns to where you were.
 */
export function PlaylistEditScreen({
  playlistId,
  seed,
}: Props): React.ReactElement {
  const existing = usePlaylist(playlistId);
  const playlists = usePlaylists();
  const {reciters} = useReciters();
  const pop = useNavStore(s => s.pop);
  const push = useNavStore(s => s.push);

  const [draft, setDraft] = useState<NameDraft>(() => ({
    text: existing?.name ?? nextPlaylistName(playlists),
    fresh: true,
  }));
  const [color, setColor] = useState<string>(
    () =>
      existing?.color ??
      (existing ? FALLBACK_PLAYLIST_COLOR : nextPlaylistColor(playlists)),
  );
  const [mode, setMode] = useState<KeyboardMode>('letters');
  // Right from the keyboard (or up from nothing) enters the side column on
  // Save rather than on the nearest swatch.
  const [saveWrap, setSaveWrap] = useState<View | null>(null);

  const renaming = playlistId !== undefined;
  const seedVoice = seed
    ? reciters.find(r => r.id === seed.reciterId)?.name
    : undefined;
  const previewSurah = seed?.surahNumber ?? existing?.items[0]?.surahNumber;

  function save(): void {
    const name = cleanPlaylistName(draft.text);
    if (renaming) {
      if (existing) {
        renamePlaylist(existing.id, name);
        setPlaylistColor(existing.id, color);
      }
      pop();
      return;
    }
    const id = createPlaylist(name, seed ? [seed] : [], color);
    pop();
    if (seed) {
      showToast(`Added ${surahTitle(seed.surahNumber)} to ${name}`);
    } else {
      // Made from the Library: open it, where its empty state says how to
      // fill it.
      push({screen: 'playlist', playlistId: id});
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.main}>
        <Text style={styles.kicker}>
          {renaming ? 'RENAME PLAYLIST' : 'NEW PLAYLIST'}
        </Text>
        <View style={styles.field}>
          {draft.text.length === 0 ? (
            <Text style={[styles.name, styles.placeholder]} numberOfLines={1}>
              Playlist name
            </Text>
          ) : (
            <Text
              style={[styles.name, draft.fresh && styles.nameFresh]}
              numberOfLines={1}
              ellipsizeMode="head">
              {draft.text}
            </Text>
          )}
          {draft.fresh ? null : <View style={styles.caret} />}
        </View>
        <Text style={styles.hint} numberOfLines={1}>
          {seed
            ? `Starts with ${surahTitle(seed.surahNumber)}${
                seedVoice ? ` · ${shortReciterName(seedVoice)}` : ''
              }`
            : draft.fresh
              ? 'Type to replace the name, or Save to keep it.'
              : ' '}
        </Text>
        <View style={styles.keyboard}>
          <SearchKeyboard
            mode={mode}
            onKey={key => setDraft(d => draftKey(d, key))}
            onSpace={() => setDraft(draftSpace)}
            onDelete={() => setDraft(draftDelete)}
            onClear={() => setDraft({text: '', fresh: false})}
            onMode={() => setMode(nextMode)}
            preferFirstKey
          />
        </View>
      </View>

      <TVFocusGuideView
        destinations={saveWrap ? [saveWrap] : undefined}
        trapFocusRight
        style={styles.side}>
        <View style={styles.preview}>
          <GradientFill colors={playlistGradient(color)} id="playlist-edit" />
          <View style={styles.previewArt}>
            {previewSurah ? (
              <SurahGlyph surahNumber={previewSurah} size={110} />
            ) : (
              <PlaylistIcon color={colors.textSecondary} size={scale(76)} />
            )}
          </View>
        </View>
        <Text style={styles.label}>COLOUR</Text>
        <View style={styles.swatches}>
          {PLAYLIST_COLORS.map(c => {
            const selected = c.toUpperCase() === color.toUpperCase();
            return (
              <FocusableCard
                key={c}
                ring={false}
                onPress={() => setColor(c)}
                accessibilityLabel={selected ? 'Colour, selected' : 'Colour'}>
                <FocusFrame radius={SWATCH / 2} style={styles.swatchFrame}>
                  <View style={[styles.swatch, {backgroundColor: c}]}>
                    {selected ? (
                      <CheckIcon color={colors.text} size={scale(28)} />
                    ) : null}
                  </View>
                </FocusFrame>
              </FocusableCard>
            );
          })}
        </View>
        <View style={styles.actions}>
          <View ref={setSaveWrap}>
            <FocusableButton
              onPress={save}
              accessibilityLabel={
                renaming ? 'Save' : `Create ${cleanPlaylistName(draft.text)}`
              }
              outlined
              style={styles.btn}>
              <FocusText style={styles.btnText}>
                {renaming ? 'Save' : 'Create'}
              </FocusText>
            </FocusableButton>
          </View>
          <FocusableButton
            onPress={pop}
            accessibilityLabel="Cancel"
            style={styles.btn}>
            <FocusText style={styles.btnText}>Cancel</FocusText>
          </FocusableButton>
        </View>
      </TVFocusGuideView>
    </View>
  );
}

const SWATCH_FRAME = SWATCH + 18;

const styles = createScaledStyles({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
    paddingTop: 88,
    paddingLeft: 120,
    paddingRight: 96,
    gap: 120,
  },
  main: {width: 640},
  kicker: {
    color: colors.textTertiary,
    fontFamily: fonts.extraBold,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
  },
  field: {
    height: 96,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: colors.border,
  },
  name: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 54,
    fontWeight: '700',
    letterSpacing: -1,
  },
  // A prefilled name reads as a suggestion until the first key.
  nameFresh: {color: colors.textSecondary},
  placeholder: {color: colors.textTertiary},
  caret: {
    width: 3,
    height: 56,
    marginLeft: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  hint: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 21,
    fontWeight: '500',
    marginTop: 14,
  },
  keyboard: {marginTop: 36},
  side: {width: 560},
  preview: {
    width: PREVIEW,
    height: PREVIEW,
    borderRadius: 28,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  previewArt: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  label: {
    color: colors.textTertiary,
    fontFamily: fonts.extraBold,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 36,
    marginBottom: 10,
  },
  // The swatches' focus ring reserves its space: pull the grid out by it.
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: SWATCH_FRAME * 6,
    marginLeft: -9,
  },
  swatchFrame: {width: SWATCH_FRAME, height: SWATCH_FRAME},
  swatch: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  actions: {flexDirection: 'row', gap: 14, marginTop: 36},
  btn: {paddingHorizontal: 34, paddingVertical: 16, borderRadius: 16},
  btnText: {fontFamily: fonts.bold, fontSize: 24, fontWeight: '700'},
});
