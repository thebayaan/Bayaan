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
    ...typography.label,
    marginBottom: 10,
  },
});
