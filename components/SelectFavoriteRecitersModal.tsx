import React, {useState, useCallback} from 'react';
import {View, Text, FlatList, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {CircularReciterCard} from '@/components/cards/CircularReciterCard';
import {RECITERS, Reciter} from '@/data/reciterData';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import SearchBar from '@/components/SearchBar';
import BottomSheetModal from '@/components/BottomSheetModal';
import {Theme} from '@/utils/themeUtils';
import {Button} from '@/components/Button';
import {LinearGradient} from 'expo-linear-gradient';

interface SelectFavoriteRecitersModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export const SelectFavoriteRecitersModal: React.FC<
  SelectFavoriteRecitersModalProps
> = ({isVisible, onClose}) => {
  const {theme} = useTheme();
  const {toggleFavoriteReciter, favoriteReciters} = useFavoriteReciters();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredReciters = RECITERS.filter(reciter =>
    reciter.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleReciterPress = useCallback(
    (reciter: Reciter) => {
      toggleFavoriteReciter(reciter.id);
    },
    [toggleFavoriteReciter],
  );

  const renderItem = ({item}: {item: Reciter}) => (
    <CircularReciterCard
      imageUrl={item.image_url}
      name={item.name}
      onPress={() => handleReciterPress(item)}
      isSelected={favoriteReciters.some(reciter => reciter.id === item.id)}
    />
  );

  return (
    <BottomSheetModal
      isVisible={isVisible}
      onClose={onClose}
      snapPoints={['92%']}>
      <View style={styles(theme).container}>
        <Text style={[styles(theme).title, {color: theme.colors.text}]}>
          Edit Favorite Reciters
        </Text>
        <View style={styles(theme).searchContainer}>
          <SearchBar
            placeholder="Search reciters..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <FlatList
          data={filteredReciters}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={3}
          contentContainerStyle={styles(theme).gridContainer}
          columnWrapperStyle={styles(theme).columnWrapper}
        />
        <View style={styles(theme).footerContainer}>
          <LinearGradient
            colors={[
              'transparent',
              theme.colors.background + '80',
              theme.colors.background,
            ]}
            style={styles(theme).footerGradient}>
            <Button
              title="Finish"
              onPress={onClose}
              style={styles(theme).button}
              textStyle={styles(theme).buttonText}
              size="medium"
            />
          </LinearGradient>
        </View>
      </View>
    </BottomSheetModal>
  );
};

const styles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    title: {
      fontSize: moderateScale(24),
      fontWeight: 'bold',
      marginBottom: verticalScale(16),
    },
    searchContainer: {
      paddingBottom: moderateScale(15),
    },
    gridContainer: {
      paddingHorizontal: moderateScale(5),
      paddingBottom: moderateScale(100),
    },
    columnWrapper: {
      justifyContent: 'space-evenly',
      marginBottom: verticalScale(15),
    },
    footerContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    footerGradient: {
      paddingTop: moderateScale(30),
      paddingBottom: moderateScale(20),
      alignItems: 'center',
    },
    button: {
      width: '35%',
      backgroundColor: theme.colors.text,
      borderRadius: moderateScale(30),
    },
    buttonText: {
      color: theme.colors.background,
      fontWeight: 'bold',
      fontSize: moderateScale(14),
    },
  });
