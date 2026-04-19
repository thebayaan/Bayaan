import React from 'react';
import {StyleSheet, Text} from 'react-native';
import {colors} from '../../theme/colors';
import {typography} from '../../theme/typography';

type Props = {title: string};

export function RailHeader({title}: Props): React.ReactElement {
  return <Text style={styles.label}>{title}</Text>;
}

const styles = StyleSheet.create({
  label: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 14,
    opacity: 0.85,
  },
});
