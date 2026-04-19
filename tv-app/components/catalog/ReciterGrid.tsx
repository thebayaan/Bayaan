import {FlashList} from '@shopify/flash-list';
import React from 'react';
import {View} from 'react-native';
import {ReciterCard} from '../rails/ReciterCard';
import type {Reciter} from '../../types/reciter';

type Props = {
  reciters: Reciter[];
  onSelect: (r: Reciter) => void;
};

function overrideItemLayout(layout: {span?: number}): void {
  // Each item spans exactly 1 column; height fixed at 180
  layout.span = 1;
}

export function ReciterGrid({reciters, onSelect}: Props): React.ReactElement {
  return (
    <FlashList
      data={reciters}
      numColumns={6}
      overrideItemLayout={overrideItemLayout}
      renderItem={({item, index}) => (
        <View style={{padding: 8}}>
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
