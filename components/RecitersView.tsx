import React from 'react';
import {View, Text, ScrollView, FlatList, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {ReciterCard} from './cards/ReciterCard';
import {RECITERS, Reciter} from '@/data/reciterData';

interface RecitersViewProps {
  onReciterPress: (reciter: Reciter) => void;
}

export default function RecitersView({onReciterPress}: RecitersViewProps) {
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

  const renderReciterCard = ({item}: {item: Reciter}) => (
    <ReciterCard
      image={{uri: item.image_url}}
      name={item.name}
      moshafName={item.moshaf_name}
      onPress={() => onReciterPress(item)}
    />
  );

  const renderSection = (title: string, data: Reciter[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <FlatList
        data={data}
        renderItem={renderReciterCard}
        keyExtractor={item => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{paddingHorizontal: moderateScale(15)}}
      />
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {renderSection('Recents', RECITERS.slice(0, 5))}
      {renderSection('Featured', RECITERS.slice(5, 10))}
      {renderSection('New', RECITERS.slice(10, 15))}
      {renderSection('From your Collection', RECITERS.slice(15, 20))}
    </ScrollView>
  );
}
