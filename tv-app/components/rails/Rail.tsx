import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {RailHeader} from './RailHeader';
import {spacing} from '../../theme/spacing';

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

const styles = StyleSheet.create({
  section: {marginBottom: spacing.lg},
  rail: {gap: spacing.sm, paddingRight: spacing.xl},
});
