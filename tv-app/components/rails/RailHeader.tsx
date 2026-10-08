import React from 'react';
import {Text} from 'react-native';
import {colors} from '../../theme/colors';
import {createScaledStyles} from '../../theme/scale';

type Props = {title: string};

export function RailHeader({title}: Props): React.ReactElement {
  return <Text style={styles.label}>{title}</Text>;
}

const styles = createScaledStyles({
  label: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 16,
    marginTop: 8,
  },
});
