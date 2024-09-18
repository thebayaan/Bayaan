import React from 'react';
import {View, Text, ScrollView, FlatList, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {SurahCard} from './cards/SurahCard';
import {SURAHS, Surah} from '@/data/surahData';

interface SurahsViewProps {
  onSurahPress: (surah: Surah) => void;
}

export default function SurahsView({onSurahPress}: SurahsViewProps) {
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

  const renderSurahCard = ({item}: {item: Surah}) => (
    <SurahCard
      id={item.id}
      name={item.name}
      translatedName={item.translated_name_english}
      onPress={() => onSurahPress(item)}
    />
  );

  const renderSection = (title: string, data: Surah[]) => (
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
      {renderSection('Recents', SURAHS.slice(0, 5))}
      {renderSection('Surah of the Day', [SURAHS[0]])}
      {renderSection('Most Played', SURAHS.slice(5, 10))}
      {renderSection('From your Collection', SURAHS.slice(10, 15))}
    </ScrollView>
  );
}
