import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Keyboard,
  Platform,
  Text,
  TextInput,
  TVFocusGuideView,
  View,
} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {FocusIcon} from '../primitives/focusContext';
import {MicrophoneIcon, SearchIcon} from '../../../components/Icons';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles, scale} from '../../theme/scale';
import {isRtlText, MAX_QUERY_CHARS} from '../../services/search/keyboard';

/** How long the mic asks for focus back after the system entry closes. */
const REFOCUS_MS = 800;

type Props = {
  query: string;
  onChangeQuery: (query: string) => void;
};

/**
 * The search bar above the keyboard: what has been typed, with a caret, and
 * a mic. The mic opens the platform's own text entry, which takes dictation
 * on the Siri Remote and voice on Android TV remotes; whatever is said or
 * typed there comes back into the bar.
 *
 * The hidden input is mounted only while that entry is open. Closing it hands
 * focus back to the mic in the same render the input unmounts, so focus never
 * falls to wherever the platform puts it. Android's Back hides the IME
 * without ending the edit, so the keyboard hiding closes it there too.
 *
 * The bar is a focus guide across the keyboard's full width, so Up from any
 * key of the top row reaches the mic (on tvOS only the last column sits
 * under it). An Arabic query is drawn right to left with the caret on its
 * left, where the next letter appears.
 */
export function SearchBar({query, onChangeQuery}: Props): React.ReactElement {
  const [systemEntry, setSystemEntry] = useState(false);
  const [focusMic, setFocusMic] = useState(false);
  const input = useRef<TextInput>(null);
  // Submit, end-editing and blur can all fire for one close; act once.
  const open = useRef(false);
  const empty = query.length === 0;
  const rtl = isRtlText(query);

  const openEntry = useCallback(() => {
    open.current = true;
    setSystemEntry(true);
  }, []);

  const closeEntry = useCallback(() => {
    if (!open.current) return;
    open.current = false;
    setSystemEntry(false);
    setFocusMic(true);
  }, []);

  useEffect(() => {
    if (!systemEntry || Platform.OS !== 'android') return;
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      input.current?.blur();
      closeEntry();
    });
    return () => sub.remove();
  }, [systemEntry, closeEntry]);

  useEffect(() => {
    if (!focusMic) return;
    const t = setTimeout(() => setFocusMic(false), REFOCUS_MS);
    return () => clearTimeout(t);
  }, [focusMic]);

  return (
    <TVFocusGuideView autoFocus style={styles.bar}>
      <SearchIcon color={colors.textSecondary} size={scale(30)} />
      <View style={[styles.textWrap, rtl && styles.textWrapRtl]}>
        {empty ? (
          <Text style={[styles.text, styles.placeholder]} numberOfLines={1}>
            Surah, reciter or dua
          </Text>
        ) : (
          // "head" keeps the end of a long query, the letters just typed,
          // in either direction.
          <Text
            style={[styles.text, rtl && styles.textRtl]}
            numberOfLines={1}
            ellipsizeMode="head">
            {query}
          </Text>
        )}
        {empty ? null : <View style={[styles.caret, rtl && styles.caretRtl]} />}
      </View>
      <FocusableButton
        onPress={openEntry}
        hasTVPreferredFocus={focusMic}
        accessibilityLabel="Search by voice"
        style={styles.mic}>
        <FocusIcon
          icon={MicrophoneIcon}
          size={26}
          color={colors.textSecondary}
        />
      </FocusableButton>
      {systemEntry ? (
        // Mounted only while in use, so it never sits in the focus path.
        <TextInput
          ref={input}
          autoFocus
          value={query}
          onChangeText={text => onChangeQuery(text.slice(0, MAX_QUERY_CHARS))}
          onSubmitEditing={closeEntry}
          onEndEditing={closeEntry}
          onBlur={closeEntry}
          placeholder="Surah, reciter or dua"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={styles.hiddenInput}
        />
      ) : null}
    </TVFocusGuideView>
  );
}

const styles = createScaledStyles({
  bar: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderBottomWidth: 2,
    borderColor: colors.border,
  },
  textWrap: {flex: 1, flexDirection: 'row', alignItems: 'center'},
  // The caret leads in the row, so it sits on the left of the text, and the
  // text hugs the bar's right edge like Arabic does.
  textWrapRtl: {flexDirection: 'row-reverse'},
  textRtl: {writingDirection: 'rtl'},
  text: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 36,
    fontWeight: '500',
    letterSpacing: -0.5,
  },
  placeholder: {color: colors.textTertiary},
  caret: {
    width: 3,
    height: 40,
    marginLeft: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  caretRtl: {marginLeft: 0, marginRight: 4},
  mic: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
});
