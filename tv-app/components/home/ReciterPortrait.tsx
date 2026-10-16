import React from 'react';
import {Image} from 'expo-image';
import {Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {FocusFrame, FocusText} from '../primitives/focusContext';
import {useContextMenuStore} from '../../store/contextMenuStore';
import {getReciterArtwork} from '../../services/reciterArtwork';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';
import type {Reciter} from '../../types/reciter';

const SIZE = 160;
const FRAME = SIZE + 18; // ring 4 + gap 5 on each side

type Props = {
  reciter: Reciter;
  onSelect: (reciter: Reciter) => void;
};

/**
 * A reciter as a round portrait with the name below, sized so a full row
 * fits under the hero (the shared ReciterCard is larger). Long press opens
 * the reciter menu, like everywhere else.
 */
function ReciterPortraitImpl({reciter, onSelect}: Props): React.ReactElement {
  const artwork = getReciterArtwork(reciter);
  return (
    <FocusableCard
      ring={false}
      style={styles.card}
      onPress={() => onSelect(reciter)}
      onLongPress={() => useContextMenuStore.getState().open(reciter.id)}
      accessibilityLabel={reciter.name}>
      <FocusFrame radius={SIZE / 2} style={styles.frame}>
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
        numberOfLines={1}>
        {reciter.name}
      </FocusText>
    </FocusableCard>
  );
}

export const ReciterPortrait = React.memo(ReciterPortraitImpl);

const styles = createScaledStyles({
  card: {width: FRAME, alignItems: 'center', gap: 10},
  frame: {width: FRAME, height: FRAME},
  img: {width: '100%', height: '100%'},
  placeholder: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {color: colors.text, fontSize: 56, fontWeight: '300', opacity: 0.35},
  name: {
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 17,
    textAlign: 'center',
  },
});
