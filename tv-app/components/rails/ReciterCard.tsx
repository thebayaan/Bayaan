import React from 'react';
import {Image} from 'expo-image';
import {Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {FocusFrame, FocusText} from '../primitives/focusContext';
import {useContextMenuStore} from '../../store/contextMenuStore';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import type {Reciter} from '../../types/reciter';
import {createScaledStyles} from '../../theme/scale';
import {getReciterArtwork} from '../../services/reciterArtwork';

type Props = {
  reciter: Reciter;
  onSelect: (r: Reciter) => void;
  hasTVPreferredFocus?: boolean;
};

/** A reciter as a round portrait with their name below (Ink & Cream). */
function ReciterCardImpl({
  reciter,
  onSelect,
  hasTVPreferredFocus,
}: Props): React.ReactElement {
  const artwork = getReciterArtwork(reciter);
  return (
    <FocusableCard
      ring={false}
      style={styles.card}
      onPress={() => onSelect(reciter)}
      onLongPress={() => useContextMenuStore.getState().open(reciter.id)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={reciter.name}>
      <FocusFrame radius={PORTRAIT / 2} style={styles.frame}>
        {artwork ? (
          <Image
            source={artwork}
            style={styles.img}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.initial}>
              {reciter.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </FocusFrame>
      <FocusText
        style={styles.name}
        color={colors.textSecondary}
        focusedColor={colors.text}
        numberOfLines={2}>
        {reciter.name}
      </FocusText>
    </FocusableCard>
  );
}

export const ReciterCard = React.memo(ReciterCardImpl);

const CARD_WIDTH = 200;
// Portrait diameter inside the focus frame (ring 4 + gap 5 on each side).
const PORTRAIT = CARD_WIDTH - 18;

const styles = createScaledStyles({
  card: {width: CARD_WIDTH, height: 280, alignItems: 'center', gap: 12},
  frame: {width: CARD_WIDTH, height: CARD_WIDTH},
  img: {width: '100%', height: '100%'},
  placeholder: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {color: colors.text, fontSize: 64, fontWeight: '300', opacity: 0.35},
  name: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 6,
  },
});
