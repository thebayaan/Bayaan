import React from 'react';
import {Image} from 'expo-image';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {colors} from '../../theme/colors';
import {typography} from '../../theme/typography';
import type {Reciter} from '../../types/reciter';

type Props = {
  reciter: Reciter;
  onSelect: (r: Reciter) => void;
  hasTVPreferredFocus?: boolean;
};

export function ReciterCard({
  reciter,
  onSelect,
  hasTVPreferredFocus,
}: Props): React.ReactElement {
  return (
    <FocusableCard
      style={styles.card}
      onPress={() => onSelect(reciter)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={reciter.name}>
      <View style={styles.artwork}>
        {reciter.image_url ? (
          <Image
            source={{uri: reciter.image_url}}
            style={styles.img}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {reciter.name}
      </Text>
    </FocusableCard>
  );
}

const CARD_WIDTH = 140;
const CARD_HEIGHT = 180;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  artwork: {flex: 1, backgroundColor: colors.surfaceElevated},
  img: {width: '100%', height: '100%'},
  placeholder: {flex: 1, backgroundColor: colors.surfaceElevated},
  name: {color: colors.text, ...typography.caption, padding: 10},
});
