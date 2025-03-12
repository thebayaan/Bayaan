import React, {useState, useCallback, useRef} from 'react';
import {View, Text, FlatList, StyleSheet, Platform} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {CircularReciterCard} from '@/components/cards/CircularReciterCard';
import {RECITERS, Reciter} from '@/data/reciterData';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import SearchBar from '@/components/SearchBar';
import {BaseModal} from '@/components/modals/BaseModal';
import {Theme} from '@/utils/themeUtils';
import {Button} from '@/components/Button';
import Color from 'color';
import BottomSheet from '@gorhom/bottom-sheet';

interface SelectFavoriteRecitersModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export const SelectFavoriteRecitersModal: React.FC<
  SelectFavoriteRecitersModalProps
> = ({isVisible, onClose}) => {
  const {theme} = useTheme();
  const {toggleFavorite, favoriteReciters} = useFavoriteReciters();
  const [searchQuery, setSearchQuery] = useState('');
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Effect to control the modal visibility
  React.useEffect(() => {
    if (isVisible) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isVisible]);

  const filteredReciters = RECITERS.filter(reciter =>
    reciter.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleReciterPress = useCallback(
    (reciter: Reciter) => {
      toggleFavorite(reciter);
    },
    [toggleFavorite],
  );

  const renderItem = ({item}: {item: Reciter}) => (
    <CircularReciterCard
      imageUrl={item.image_url || undefined}
      name={item.name}
      onPress={() => handleReciterPress(item)}
      isSelected={favoriteReciters.some(reciter => reciter.id === item.id)}
    />
  );

  return (
    <BaseModal
      bottomSheetRef={bottomSheetRef}
      snapPoints={['92%']}
      title="Edit Favorite Reciters"
      onChange={index => {
        if (index === -1) {
          onClose();
        }
      }}>
      <View style={styles(theme).container}>
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
          nestedScrollEnabled={Platform.OS === 'android'}
          scrollEventThrottle={16}
        />
        <View style={styles(theme).footerContainer}>
          <View style={styles(theme).footer}>
            <Button
              title="Done"
              onPress={onClose}
              style={styles(theme).button}
              textStyle={styles(theme).buttonText}>
              <Text style={styles(theme).buttonText}>Done</Text>
            </Button>
          </View>
        </View>
      </View>
    </BaseModal>
  );
};

const styles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    searchContainer: {
      padding: moderateScale(16),
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    gridContainer: {
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(8),
    },
    columnWrapper: {
      justifyContent: 'space-evenly',
      marginBottom: moderateScale(16),
    },
    footerContainer: {
      backgroundColor: theme.colors.background,
      borderTopWidth: 1,
      borderTopColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    footer: {
      padding: moderateScale(16),
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    button: {
      backgroundColor: Color(theme.colors.text).alpha(0.9).toString(),
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(24),
      borderRadius: moderateScale(12),
    },
    buttonText: {
      color: theme.colors.background,
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
    },
  });
