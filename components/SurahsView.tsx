import React from 'react';
import {View, Text, ScrollView, FlatList, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {SurahCard} from './cards/SurahCard';

// This is dummy data. Replace it with actual data from your API or database.
const dummySurahs = [
  {id: 1, name: 'Al-Fatihah', translatedName: 'The Opener'},
  {id: 2, name: 'Al-Baqarah', translatedName: 'The Cow'},
  {id: 3, name: "Ali'Imran", translatedName: 'Family of Imran'},
  {id: 4, name: 'An-Nisa', translatedName: 'The Women'},
  {id: 5, name: "Al-Ma'idah", translatedName: 'The Table Spread'},
];

export default function SurahsView() {
  const {theme} = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    section: {
      marginBottom: verticalScale(20),
    },
    sectionTitle: {
      fontSize: moderateScale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: verticalScale(10),
      paddingHorizontal: moderateScale(15),
    },
  });

  const handleSurahPress = (surahId: number) => {
    console.log(`Surah pressed: ${surahId}`);
    // Navigate to surah details or start playing
  };

  const renderSurahCard = ({
    item,
  }: {
    item: {id: number; name: string; translatedName: string};
  }) => (
    <SurahCard
      id={item.id}
      name={item.name}
      translatedName={item.translatedName}
      onPress={() => handleSurahPress(item.id)}
    />
  );

  const renderSection = (title: string, data: typeof dummySurahs) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <FlatList
        data={data}
        renderItem={renderSurahCard}
        keyExtractor={item => item.id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{paddingHorizontal: moderateScale(15)}}
      />
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {renderSection('Recents', dummySurahs)}
      {renderSection('Surah of the Day', [dummySurahs[0]])}
      {renderSection('Most Played', dummySurahs)}
      {renderSection('From your Collection', dummySurahs)}
    </ScrollView>
  );
}
