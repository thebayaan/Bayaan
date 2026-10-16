import React from 'react';
import {Text, View} from 'react-native';
import {colors} from '../theme/colors';
import {typography} from '../theme/typography';

/** Placeholder until this screen is built. */
export function SurahsScreen(): React.ReactElement {
  return (
    <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
      <Text style={[typography.title, {color: colors.text}]}>Coming soon</Text>
    </View>
  );
}
