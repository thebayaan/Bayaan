import React from 'react';
import {View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {FocusFrame, FocusText} from '../primitives/focusContext';
import {ReciterPortrait} from './ReciterPortrait';
import {useContextMenuStore} from '../../store/contextMenuStore';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';
import type {Reciter} from '../../types/reciter';

type Props = {
  reciter: Reciter;
  subtitle: string;
  onSelect: (reciter: Reciter) => void;
  hasTVPreferredFocus?: boolean;
};

export const RECITER_CARD_WIDTH = 184;

/**
 * A reciter in the browse grid: round portrait with a cream ring on focus,
 * name and rewayah/style line below. Long press opens the reciter context
 * menu, like the rail cards.
 */
function BrowseReciterCardImpl({
  reciter,
  subtitle,
  onSelect,
  hasTVPreferredFocus,
}: Props): React.ReactElement {
  return (
    <FocusableCard
      ring={false}
      style={styles.card}
      onPress={() => onSelect(reciter)}
      onLongPress={() => useContextMenuStore.getState().open(reciter.id)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={
        subtitle ? `${reciter.name}, ${subtitle}` : reciter.name
      }>
      <FocusFrame radius={PORTRAIT / 2} style={styles.frame}>
        <ReciterPortrait reciter={reciter} size={PORTRAIT} idPrefix="browse" />
      </FocusFrame>
      <View style={styles.meta}>
        <FocusText
          style={styles.name}
          color={colors.textSecondary}
          focusedColor={colors.text}
          numberOfLines={2}>
          {reciter.name}
        </FocusText>
        {subtitle ? (
          <FocusText
            style={styles.sub}
            color={colors.textTertiary}
            focusedColor={colors.textSecondary}
            numberOfLines={1}>
            {subtitle}
          </FocusText>
        ) : null}
      </View>
    </FocusableCard>
  );
}

export const BrowseReciterCard = React.memo(BrowseReciterCardImpl);

// Portrait diameter inside the focus frame (ring 4 + gap 5 on each side).
const PORTRAIT = RECITER_CARD_WIDTH - 18;
const NAME_LINE = 23;

const styles = createScaledStyles({
  card: {width: RECITER_CARD_WIDTH, alignItems: 'center', gap: 10},
  frame: {width: RECITER_CARD_WIDTH, height: RECITER_CARD_WIDTH},
  meta: {alignItems: 'center', gap: 2, alignSelf: 'stretch'},
  // Long names wrap to a second line rather than losing their end; every
  // card keeps the two-line slot, so the subtitles of a row stay level.
  name: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: NAME_LINE,
    minHeight: NAME_LINE * 2,
    textAlign: 'center',
  },
  sub: {
    fontFamily: fonts.medium,
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
  },
});
