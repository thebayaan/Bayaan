import {FlashList} from '@shopify/flash-list';
import React from 'react';
import {useWindowDimensions, View} from 'react-native';
import {ReciterCard} from '../rails/ReciterCard';
import type {Reciter} from '../../types/reciter';

type Props = {
  reciters: Reciter[];
  onSelect: (r: Reciter) => void;
};

function overrideItemLayout(layout: {span?: number}): void {
  layout.span = 1;
}

export function ReciterGrid({reciters, onSelect}: Props): React.ReactElement {
  const {width} = useWindowDimensions();
  const numColumns = width >= 1800 ? 6 : width >= 1400 ? 5 : 4;
  return (
    <FlashList
      data={reciters}
      numColumns={numColumns}
      overrideItemLayout={overrideItemLayout}
      renderItem={({item, index}) => (
        <View style={{padding: 10}}>
          <ReciterCard
            reciter={item}
            onSelect={onSelect}
            hasTVPreferredFocus={index === 0}
          />
        </View>
      )}
      keyExtractor={r => r.id}
    />
  );
}
