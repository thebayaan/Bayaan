import React from 'react';
import {View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {FocusFrame, FocusText} from '../primitives/focusContext';
import {GradientFill} from '../brand/GradientFill';
import {SurahGlyph} from '../brand/SurahGlyph';
import {surahGradient} from '../../theme/surahColors';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

type Props = {
  surahNumber: number;
  surahName: string;
  onSelect: (n: number) => void;
};

/** A surah as calligraphy on its pigment, with its name below. */
export function QuickPlayCard({
  surahNumber,
  surahName,
  onSelect,
}: Props): React.ReactElement {
  return (
    <FocusableCard
      ring={false}
      style={styles.card}
      onPress={() => onSelect(surahNumber)}
      accessibilityLabel={`Play ${surahName}`}>
      <FocusFrame radius={14} style={styles.frame}>
        <View style={styles.art}>
          <GradientFill
            colors={surahGradient(surahNumber)}
            id={`quick-play-${surahNumber}`}
          />
          <SurahGlyph surahNumber={surahNumber} size={64} />
        </View>
      </FocusFrame>
      <View style={styles.meta}>
        <FocusText style={styles.name} numberOfLines={1}>
          {surahName}
        </FocusText>
        <FocusText
          style={styles.num}
          color={colors.textSecondary}
          focusedColor={colors.textSecondary}>
          Surah {surahNumber}
        </FocusText>
      </View>
    </FocusableCard>
  );
}

const styles = createScaledStyles({
  card: {width: 188, gap: 10},
  frame: {width: 188, height: 188},
  art: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  meta: {paddingHorizontal: 9, gap: 2},
  name: {
    fontFamily: fonts.bold,
    fontSize: 18,
    fontWeight: '700',
  },
  num: {
    fontFamily: fonts.medium,
    fontSize: 14,
    fontWeight: '500',
  },
});
