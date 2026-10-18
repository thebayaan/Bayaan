import React from 'react';
import {Text, View} from 'react-native';
import {FocusableButton, FocusText} from '../primitives/FocusableButton';
import {useFocusTint} from '../primitives/focusContext';
import {ClockGlyph, MagnifierGlyph} from './SearchGlyphs';
import {splitLabel, type Suggestion} from '../../services/search/suggestions';
import {colors} from '../../theme/colors';
import {fonts, typography} from '../../theme/typography';
import {createScaledStyles, scale} from '../../theme/scale';

const MAX_RECENTS = 5;

type Props = {
  typing: boolean;
  recents: readonly string[];
  suggestions: readonly Suggestion[];
  onRecent: (query: string) => void;
  onSuggestion: (suggestion: Suggestion) => void;
  onClearRecents: () => void;
};

/**
 * Under the keyboard: recent searches before typing, then completions as you
 * type, each tagged Surah, Reciter, Adhkar or Verse. Rows are keyed by place,
 * so focus stays on its row while the list changes underneath it.
 */
export function SearchSideList({
  typing,
  recents,
  suggestions,
  onRecent,
  onSuggestion,
  onClearRecents,
}: Props): React.ReactElement | null {
  if (typing) {
    if (suggestions.length === 0) return null;
    return (
      <View style={styles.block}>
        <Text style={styles.kicker}>Suggestions</Text>
        {suggestions.map((s, i) => (
          <FocusableButton
            key={`row-${i}`}
            onPress={() => onSuggestion(s)}
            accessibilityLabel={`${s.label}, ${s.kind}`}
            focusScale={1.02}
            style={styles.row}>
            <RowIcon kind="search" />
            <SuggestionText suggestion={s} />
            <FocusText
              style={styles.tag}
              color={colors.textSecondary}
              focusedColor={colors.onFocusSecondary}>
              {s.kind}
            </FocusText>
          </FocusableButton>
        ))}
      </View>
    );
  }
  if (recents.length === 0) {
    return (
      <View style={styles.block}>
        <Text style={styles.hint}>
          Type a surah, its number, a reciter or a dua. 36 is Ya-Sin; 2:255 is
          Ayat al-Kursi.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.block}>
      <Text style={styles.kicker}>Recent</Text>
      {recents.slice(0, MAX_RECENTS).map((r, i) => (
        <FocusableButton
          key={`row-${i}`}
          onPress={() => onRecent(r)}
          accessibilityLabel={`Search ${r}`}
          focusScale={1.02}
          style={styles.row}>
          <RowIcon kind="recent" />
          <FocusText style={styles.label} numberOfLines={1}>
            {r}
          </FocusText>
        </FocusableButton>
      ))}
      <FocusableButton
        key="clear"
        onPress={onClearRecents}
        accessibilityLabel="Clear recent searches"
        focusScale={1.02}
        style={styles.row}>
        <FocusText
          style={styles.clear}
          color={colors.textTertiary}
          focusedColor={colors.onFocus}>
          Clear recent searches
        </FocusText>
      </FocusableButton>
    </View>
  );
}

function RowIcon({kind}: {kind: 'search' | 'recent'}): React.ReactElement {
  const color = useFocusTint(colors.textTertiary, colors.onFocusSecondary);
  return kind === 'recent' ? (
    <ClockGlyph color={color} size={scale(22)} />
  ) : (
    <MagnifierGlyph color={color} size={scale(22)} />
  );
}

function SuggestionText({
  suggestion,
}: {
  suggestion: Suggestion;
}): React.ReactElement {
  const color = useFocusTint(colors.textSecondary, colors.onFocus);
  const strong = useFocusTint(colors.text, colors.onFocus);
  const parts = splitLabel(suggestion.label, suggestion.match);
  return (
    <Text style={[styles.label, {color}]} numberOfLines={1}>
      {parts.before}
      <Text style={[styles.match, {color: strong}]}>{parts.match}</Text>
      {parts.after}
    </Text>
  );
}

const styles = createScaledStyles({
  block: {marginTop: 36, gap: 6},
  kicker: {
    ...typography.label,
    color: colors.accent,
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  hint: {
    ...typography.body,
    color: colors.textTertiary,
    lineHeight: 30,
    paddingHorizontal: 16,
  },
  row: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  label: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 22,
    fontWeight: '500',
  },
  match: {fontFamily: fonts.bold, fontWeight: '700'},
  // Read from across the room: no smaller than 16.
  tag: {
    ...typography.label,
    fontSize: 16,
  },
  clear: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    fontWeight: '600',
    paddingLeft: 38,
  },
});
