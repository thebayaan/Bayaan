import React from 'react';
import {ScrollView, View} from 'react-native';
import {RailHeader} from './RailHeader';
import {spacing} from '../../theme/spacing';
import {createScaledStyles} from '../../theme/scale';

type Props = {
  title: string;
  children: React.ReactNode;
};

export function Rail({title, children}: Props): React.ReactElement {
  return (
    <View style={styles.section}>
      <RailHeader title={title} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = createScaledStyles({
  section: {marginBottom: spacing.md},
  // The horizontal ScrollView clips to its own frame, so reserve enough padding
  // for a focused card's 1.05 scale + glow ring: extra vertical room top/bottom
  // and a left inset so the first card does not clip when it scales up.
  rail: {
    gap: 18,
    paddingLeft: 16,
    paddingRight: spacing.xl,
    paddingVertical: 18,
  },
});
