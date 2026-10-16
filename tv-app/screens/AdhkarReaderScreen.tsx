import React from 'react';
import {Text, View} from 'react-native';
import {colors} from '../theme/colors';
import {typography} from '../theme/typography';

type Props = {listId: string};

/** Placeholder until this screen is built. */
export function AdhkarReaderScreen({listId}: Props): React.ReactElement {
  return (
    <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
      <Text style={[typography.title, {color: colors.text}]}>{listId}</Text>
    </View>
  );
}
