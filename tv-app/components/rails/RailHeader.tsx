import React from 'react';
import {StyleSheet, Text} from 'react-native';
import {colors} from '../../theme/colors';

type Props = {title: string};

export function RailHeader({title}: Props): React.ReactElement {
  return <Text style={styles.label}>{title}</Text>;
}

const styles = StyleSheet.create({
  label: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 16,
    marginTop: 8,
  },
});
