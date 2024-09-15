import React from 'react';
import {View, Text, ScrollView, FlatList, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {ReciterCard} from './cards/ReciterCard';

// Import test images
const Image1 = require('@/assets/images/1.jpeg');
const Image2 = require('@/assets/images/2.jpeg');
const Image3 = require('@/assets/images/3.jpeg');
const Image4 = require('@/assets/images/4.png');
const Image5 = require('@/assets/images/5.jpeg');

const dummyReciters = [
  {id: '1', image: Image1, name: 'Reciter 1', moshafName: 'Moshaf 1'},
  {id: '2', image: Image2, name: 'Reciter 2', moshafName: 'Moshaf 2'},
  {id: '3', image: Image3, name: 'Reciter 3', moshafName: 'Moshaf 3'},
  {id: '4', image: Image4, name: 'Reciter 4', moshafName: 'Moshaf 4'},
  {id: '5', image: Image5, name: 'Reciter 5', moshafName: 'Moshaf 5'},
];

export default function RecitersView() {
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

  const handleReciterPress = (reciterId: string) => {
    console.log(`Reciter pressed: ${reciterId}`);
    // Navigate to reciter details or start playing
  };

  const renderReciterCard = ({item}: {item: (typeof dummyReciters)[0]}) => (
    <ReciterCard
      image={item.image}
      name={item.name}
      moshafName={item.moshafName}
      onPress={() => handleReciterPress(item.id)}
    />
  );

  const renderSection = (title: string, data: typeof dummyReciters) => (
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
      {renderSection('Recents', dummyReciters)}
      {renderSection('Featured', dummyReciters)}
      {renderSection('New', dummyReciters)}
      {renderSection('From your Collection', dummyReciters)}
    </ScrollView>
  );
}
