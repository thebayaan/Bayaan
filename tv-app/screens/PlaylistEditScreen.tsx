import React, {useCallback, useRef, useState} from 'react';
import {Text, TVFocusGuideView, View} from 'react-native';
import {GradientFill} from '../components/brand/GradientFill';
import {SurahGlyph} from '../components/brand/SurahGlyph';
import {FocusWatch} from '../components/library/FocusWatch';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusableCard} from '../components/primitives/FocusableCard';
import {FocusFrame, FocusText} from '../components/primitives/focusContext';
import {SearchKeyboard} from '../components/search/SearchKeyboard';
import {usePlaylist, usePlaylists} from '../hooks/usePlaylists';
import {useReciters} from '../hooks/useReciters';
import {focusLibraryTile} from '../services/libraryShelf';
import {shortReciterName} from '../services/listeningChoices';
import {surahTitle} from '../services/playbackRouting';
import {
  FALLBACK_PLAYLIST_COLOR,
  PLAYLIST_COLORS,
  draftDelete,
  draftKey,
  draftSpace,
  isArabicText,
  nextPlaylistColor,
  nextPlaylistName,
  playlistColorName,
  playlistGradient,
  playlistTint,
  uniquePlaylistName,
  type NameDraft,
} from '../services/playlistFormat';
import {roomForPlaylist} from '../services/playlistsPicker';
import {
  cleanPlaylistName,
  createPlaylist,
  editPlaylist,
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
// Layout in design px (the container's padding and gaps below).
const PAD_LEFT = 120;
const MAIN_WIDTH = 640;
const GAP = 120;

/**
 * Name a new playlist (or rename one) on the grid keyboard and pick its
 * colour. The name comes prefilled ("Playlist 3") so Create works at once;
 * the first letter replaces it. Right from the keyboard lands on Create (or
 * Save). Back cancels. A playlist made from the Library opens straight away;
 * one made from a surah's menu takes that surah and returns to where you
 * were.
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

  // What an emptied name saves as: the suggestion, or the name being renamed.
  const [suggested] = useState<string>(
    () => existing?.name ?? nextPlaylistName(playlists),
  );
  const [draft, setDraft] = useState<NameDraft>(() => ({
    text: suggested,
    fresh: true,
  }));
  const [color, setColor] = useState<string>(
    () =>
      existing?.color ??
      (existing ? FALLBACK_PLAYLIST_COLOR : nextPlaylistColor(playlists)),
  );
  const [mode, setMode] = useState<KeyboardMode>('letters');
  // Right from the keyboard enters the side column on Create rather than on
  // the nearest swatch: an empty guide in the gap between the two redirects
  // to the button. A guide around the column itself does not work on tvOS
  // (UIKit focuses the swatch inside it directly), so the redirect lives in
  // the gap, and only while focus is on the keyboard: from the column, Left
  // must reach the keyboard, not bounce back to Create.
  const [saveButton, setSaveButton] = useState<View | null>(null);
  const sideFocus = useRef(0);
  const [inSide, setInSide] = useState<boolean>(false);
  const onSideFocus = useCallback((focused: boolean): void => {
    sideFocus.current = Math.max(0, sideFocus.current + (focused ? 1 : -1));
    setInSide(sideFocus.current > 0);
  }, []);

  const renaming = playlistId !== undefined;
  const seedVoice = seed
    ? reciters.find(r => r.id === seed.reciterId)?.name
    : undefined;
  const previewSurah = seed?.surahNumber ?? existing?.items[0]?.surahNumber;
  const typed = cleanPlaylistName(draft.text, suggested);
  // A renamed playlist keeping its own name keeps it as is, even when an
  // older (phone-made) playlist shares it: an untouched Save writes nothing.
  const name =
    existing && typed === existing.name
      ? typed
      : uniquePlaylistName(typed, playlists, playlistId);
  const arabic = isArabicText(draft.text);

  function save(): void {
    if (renaming) {
      // Only what changed is written, so an untouched Save keeps the
      // playlist's place in the Recent order.
      // A playlist saved without a colour shows the fallback; keeping it
      // is no change.
      if (existing) {
        const keptFallback =
          existing.color === undefined && color === FALLBACK_PLAYLIST_COLOR;
        editPlaylist(existing.id, {
          name,
          color: keptFallback ? undefined : color,
        });
      }
      pop();
      return;
    }
    // The store keeps at most MAX_PLAYLISTS and would drop the oldest.
    if (!roomForPlaylist(playlists.length)) return;
    const id = createPlaylist(name, seed ? [seed] : [], color);
    pop();
    if (seed) {
      showToast(`Added ${surahTitle(seed.surahNumber)} to ${name}`);
    } else {
      // Made from the Library: open it, where its empty state says how to
      // fill it. Back from it lands on its tile, not on New playlist.
      focusLibraryTile('playlists', `p:${id}`);
      push({screen: 'playlist', playlistId: id});
    }
  }

  const action = renaming ? 'Save' : 'Create';

  return (
    <View style={styles.container}>
      <View style={styles.main}>
        <Text style={styles.kicker}>
          {renaming ? 'RENAME PLAYLIST' : 'NEW PLAYLIST'}
        </Text>
        {/* Arabic is typed right to left: the caret goes on the left, where
            the next letter appears, and the name uses the system Arabic
            face (as the keyboard's Arabic keys do). */}
        <View style={[styles.field, arabic && styles.fieldArabic]}>
          {draft.text.length === 0 ? (
            <Text style={[styles.name, styles.placeholder]} numberOfLines={1}>
              Playlist name
            </Text>
          ) : (
            <Text
              style={[
                styles.name,
                arabic && styles.nameArabic,
                draft.fresh && styles.nameFresh,
              ]}
              numberOfLines={1}
              ellipsizeMode="head">
              {draft.text}
            </Text>
          )}
          {draft.fresh ? null : (
            <View style={[styles.caret, arabic && styles.caretArabic]} />
          )}
        </View>
        <Text style={styles.hint} numberOfLines={1}>
          {seed
            ? `Starts with ${surahTitle(seed.surahNumber)}${
                seedVoice ? ` · ${shortReciterName(seedVoice)}` : ''
              }`
            : draft.fresh
              ? `Type to replace the name, or ${action} to keep it.`
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

      {/* Mounted only while focus is on the keyboard. Passing no
          destinations does not clear a guide's native ones (on either
          platform), so a kept guide would still bounce Left from Create
          back to Create; unmounting it is what turns it off. */}
      {saveButton && !inSide ? (
        <TVFocusGuideView destinations={[saveButton]} style={styles.toSave} />
      ) : null}

      <TVFocusGuideView trapFocusRight style={styles.side}>
        <View style={styles.preview}>
          <GradientFill colors={playlistGradient(color)} id="playlist-edit" />
          <View style={styles.previewArt}>
            {previewSurah ? (
              <SurahGlyph
                surahNumber={previewSurah}
                size={110}
                fitWidth={PREVIEW - 40}
              />
            ) : (
              <PlaylistIcon color={colors.textSecondary} size={scale(76)} />
            )}
          </View>
        </View>
        <Text style={styles.label}>COLOUR</Text>
        <View style={styles.swatches}>
          {PLAYLIST_COLORS.map(c => {
            const selected = c.toUpperCase() === color.toUpperCase();
            const colorName = playlistColorName(c);
            return (
              <FocusableCard
                key={c}
                ring={false}
                onPress={() => setColor(c)}
                selected={selected}
                accessibilityLabel={
                  selected ? `${colorName}, selected` : colorName
                }>
                <FocusWatch onChange={onSideFocus} />
                <FocusFrame radius={SWATCH / 2} style={styles.swatchFrame}>
                  <View
                    style={[
                      styles.swatch,
                      {backgroundColor: playlistTint(c)},
                    ]}>
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
          {/* The guide's destination must be the focusable button itself: a
              plain wrapper View is flattened away natively. */}
          <FocusableButton
            ref={setSaveButton}
            onPress={save}
            accessibilityLabel={renaming ? 'Save' : `Create ${name}`}
            outlined
            style={styles.btn}>
            <FocusWatch onChange={onSideFocus} />
            <FocusText style={styles.btnText}>{action}</FocusText>
          </FocusableButton>
          <FocusableButton
            onPress={pop}
            accessibilityLabel="Cancel"
            style={styles.btn}>
            <FocusWatch onChange={onSideFocus} />
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
    paddingLeft: PAD_LEFT,
    paddingRight: 96,
    gap: GAP,
  },
  main: {width: MAIN_WIDTH},
  kicker: {
    color: colors.accent,
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
  fieldArabic: {flexDirection: 'row-reverse'},
  name: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 54,
    fontWeight: '700',
    letterSpacing: -1,
  },
  nameArabic: {fontFamily: undefined, letterSpacing: 0},
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
  caretArabic: {marginLeft: 0, marginRight: 4},
  hint: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 21,
    fontWeight: '500',
    marginTop: 14,
  },
  keyboard: {marginTop: 36},
  // A thin, empty strip down the middle of the gap between the keyboard and
  // the side column (absolute, so it takes no part in the row's gaps).
  toSave: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: PAD_LEFT + MAIN_WIDTH + GAP / 2 - 1,
    width: 2,
  },
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
    color: colors.accent,
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
