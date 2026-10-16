import React, {useState} from 'react';
import {Text, TextInput, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {FocusIcon} from '../primitives/focusContext';
import {MicrophoneIcon, SearchIcon} from '../../../components/Icons';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles, scale} from '../../theme/scale';
import {MAX_QUERY_CHARS} from '../../services/search/keyboard';

type Props = {
  query: string;
  onChangeQuery: (query: string) => void;
};

/**
 * The search bar above the keyboard: what has been typed, with a caret, and
 * a mic. The mic opens the platform's own text entry, which takes dictation
 * on the Siri Remote and voice on Android TV remotes; whatever is said or
 * typed there comes back into the bar.
 */
export function SearchBar({query, onChangeQuery}: Props): React.ReactElement {
  const [systemEntry, setSystemEntry] = useState(false);
  const empty = query.length === 0;
  return (
    <View style={styles.bar}>
      <SearchIcon color={colors.textSecondary} size={scale(30)} />
      <View style={styles.textWrap}>
        {empty ? (
          <Text style={[styles.text, styles.placeholder]} numberOfLines={1}>
            Surah, reciter or dua
          </Text>
        ) : (
          <Text style={styles.text} numberOfLines={1} ellipsizeMode="head">
            {query}
          </Text>
        )}
        {empty ? null : <View style={styles.caret} />}
      </View>
      <FocusableButton
        onPress={() => setSystemEntry(true)}
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
          autoFocus
          value={query}
          onChangeText={text => onChangeQuery(text.slice(0, MAX_QUERY_CHARS))}
          onSubmitEditing={() => setSystemEntry(false)}
          onEndEditing={() => setSystemEntry(false)}
          onBlur={() => setSystemEntry(false)}
          placeholder="Surah, reciter or dua"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={styles.hiddenInput}
        />
      ) : null}
    </View>
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
