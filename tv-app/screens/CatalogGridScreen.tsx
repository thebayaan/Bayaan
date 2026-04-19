import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors} from '../theme/colors';
import {typography} from '../theme/typography';

export function CatalogGridScreen(): React.ReactElement {
  return (
    <View style={styles.c}>
      <Text style={styles.t}>CatalogGridScreen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  c: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  t: {color: colors.text, ...typography.heading},
});
