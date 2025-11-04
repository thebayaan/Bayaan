import React from 'react';
import {View, Text, FlatList} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from './_styles';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {SurahItem} from '@/components/SurahItem';

interface DownloadedTrack {
  id: string;
  name: string;
  reciter: string;
}

// Mock data for downloads (replace with actual data source later)
const mockDownloads: DownloadedTrack[] = [
  {id: '1', name: 'Al-Fatihah', reciter: 'Mishary Rashid Alafasy'},
  {id: '2', name: 'Al-Baqarah', reciter: 'Abdul Rahman Al-Sudais'},
  // Add more mock downloads as needed
];

export default function DownloadsScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();

  const renderItem = ({item}: {item: DownloadedTrack}) => (
    <SurahItem
      item={item}
      onPress={() => {
        /* Handle press */
      }}
      showPlayButton={true}
      onPlayPress={() => {
        /* Handle play */
      }}
    />
  );

  return (
    <View style={styles.container}>
      <View style={[styles.headerContainer, {paddingTop: insets.top}]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Downloads</Text>
        </View>
      </View>
      <FlatList
        data={mockDownloads}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No downloads yet</Text>
        }
      />
    </View>
  );
}
