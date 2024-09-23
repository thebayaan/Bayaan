import React from 'react';
import {View, Text, FlatList, ScrollView} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from './styles';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {SURAHS} from '@/data/surahData';
import SurahNameSvg from '@/components/SurahNameSvg';
import {moderateScale} from 'react-native-size-matters';

export default function LibraryScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();

  const renderSurahItem = ({item}: {item: {id: number; name: string}}) => {
    return (
      <View style={styles.surahItem}>
        <SurahNameSvg
          surahNumber={item.id}
          width={moderateScale(40)}
          height={moderateScale(40)}
        />
        <Text style={styles.surahName}>{item.name}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerContainer, {paddingTop: insets.top}]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Collection</Text>
        </View>
      </View>
      <ScrollView>
        <FlatList
          data={SURAHS}
          renderItem={renderSurahItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.contentContainer}
          style={styles.flatList}
        />
      </ScrollView>
    </View>
  );
}
