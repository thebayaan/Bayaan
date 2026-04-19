import React from 'react';
import {StyleSheet, View} from 'react-native';
import {ReciterGrid} from '../components/catalog/ReciterGrid';
import {useReciters} from '../hooks/useReciters';
import {useNavStore} from '../store/navStore';
import {colors} from '../theme/colors';

export function CatalogGridScreen(): React.ReactElement {
  const {reciters} = useReciters();
  const push = useNavStore(s => s.push);
  return (
    <View style={styles.container}>
      <ReciterGrid
        reciters={reciters}
        onSelect={r => push({screen: 'reciterDetail', reciterId: r.id})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background, padding: 40},
});
