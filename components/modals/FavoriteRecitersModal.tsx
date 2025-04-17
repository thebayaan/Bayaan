import React, {useState, useCallback, useMemo, useRef} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  TouchableOpacity,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {CircularReciterCard} from '@/components/cards/CircularReciterCard';
import {RECITERS, Reciter} from '@/data/reciterData';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {BaseModal} from '@/components/modals/BaseModal';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import BottomSheet from '@gorhom/bottom-sheet';
import {SearchInput} from '@/components/SearchInput';
import {Icon} from '@rneui/themed';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface FavoriteRecitersModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  onClose: () => void;
}

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

export const FavoriteRecitersModal: React.FC<FavoriteRecitersModalProps> = ({
  bottomSheetRef,
  onClose,
}) => {
  const {theme} = useTheme();
  const {width} = useWindowDimensions();
  const styles = useMemo(() => {
    const dividerColor = Color(theme.colors.border).alpha(0.1).toString();
    return createStyles(theme, dividerColor);
  }, [theme]);
  const {toggleFavorite, favoriteReciters} = useFavoriteReciters();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const searchInputRef = useRef<TextInput>(null);

  // Create animated values outside of callbacks
  const allButtonScale = useSharedValue(1);
  const favoritesButtonScale = useSharedValue(1);

  // Pre-compute color values outside of worklets
  const allActiveBackgroundColor = useMemo(
    () => Color(theme.colors.text).alpha(0.1).toString(),
    [theme.colors.text],
  );
  const allInactiveBackgroundColor = useMemo(
    () => Color(theme.colors.card).alpha(0.5).toString(),
    [theme.colors.card],
  );
  const allActiveBorderColor = useMemo(
    () => Color(theme.colors.text).alpha(0.2).toString(),
    [theme.colors.text],
  );
  const allInactiveBorderColor = useMemo(
    () => Color(theme.colors.border).alpha(0.1).toString(),
    [theme.colors.border],
  );
  const favoritesActiveBackgroundColor = useMemo(
    () => Color(theme.colors.text).alpha(0.1).toString(),
    [theme.colors.text],
  );
  const favoritesInactiveBackgroundColor = useMemo(
    () => Color(theme.colors.card).alpha(0.5).toString(),
    [theme.colors.card],
  );
  const favoritesActiveBorderColor = useMemo(
    () => Color(theme.colors.text).alpha(0.2).toString(),
    [theme.colors.text],
  );
  const favoritesInactiveBorderColor = useMemo(
    () => Color(theme.colors.border).alpha(0.1).toString(),
    [theme.colors.border],
  );

  // Pre-compute additional colors for static elements
  const emptyIconColor = useMemo(
    () => Color(theme.colors.text).alpha(0.3).toString(),
    [theme.colors.text],
  );

  // Create animated styles
  const allButtonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{scale: allButtonScale.value}],
      backgroundColor:
        selectedCategory === 'all'
          ? allActiveBackgroundColor
          : allInactiveBackgroundColor,
      borderColor:
        selectedCategory === 'all'
          ? allActiveBorderColor
          : allInactiveBorderColor,
    };
  });

  const favoritesButtonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{scale: favoritesButtonScale.value}],
      backgroundColor:
        selectedCategory === 'favorites'
          ? favoritesActiveBackgroundColor
          : favoritesInactiveBackgroundColor,
      borderColor:
        selectedCategory === 'favorites'
          ? favoritesActiveBorderColor
          : favoritesInactiveBorderColor,
    };
  });

  // Calculate columns and dimensions
  const numColumns = useMemo(() => {
    const minCardWidth = moderateScale(95);
    return Math.max(3, Math.floor((width - moderateScale(32)) / minCardWidth));
  }, [width]);

  // Filter reciters based on search query
  const filteredReciters = useMemo(() => {
    let result = [...RECITERS];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(reciter => {
        if (reciter.name.toLowerCase().includes(query)) return true;
        return reciter.rewayat.some(rewaya =>
          rewaya.name?.toLowerCase().includes(query),
        );
      });
    }

    // Apply category filter (can be expanded in the future)
    if (selectedCategory === 'favorites') {
      const favoriteIds = new Set(favoriteReciters.map(r => r.id));
      result = result.filter(reciter => favoriteIds.has(reciter.id));
    }

    return result;
  }, [searchQuery, selectedCategory, favoriteReciters]);

  const handleReciterPress = useCallback(
    (reciter: Reciter) => {
      toggleFavorite(reciter);
    },
    [toggleFavorite],
  );

  const handleCategoryPress = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  const handlePressIn = useCallback(
    (scaleValue: Animated.SharedValue<number>) => {
      scaleValue.value = withSpring(0.95, {
        damping: 15,
        stiffness: 300,
      });
    },
    [],
  );

  const handlePressOut = useCallback(
    (scaleValue: Animated.SharedValue<number>) => {
      scaleValue.value = withSpring(1, {
        damping: 15,
        stiffness: 300,
      });
    },
    [],
  );

  // Calculate item width based on number of columns
  const itemWidth = useMemo(() => {
    const totalHorizontalPadding = moderateScale(32); // Side padding
    const gapSpace = moderateScale(8) * (numColumns - 1); // Gaps between items
    const availableWidth = width - totalHorizontalPadding - gapSpace;
    return availableWidth / numColumns;
  }, [width, numColumns]);

  // Render each reciter card
  const renderItem = useCallback(
    ({item}: {item: Reciter}) => {
      const isSelected = favoriteReciters.some(
        reciter => reciter.id === item.id,
      );

      const cardSize = itemWidth * 0.85; // Adjust card size to be slightly smaller than the cell width

      return (
        <View
          style={{
            width: itemWidth,
            alignItems: 'center',
            marginBottom: moderateScale(16),
          }}>
          <CircularReciterCard
            imageUrl={item.image_url || undefined}
            name={item.name}
            onPress={() => handleReciterPress(item)}
            width={cardSize}
            isSelected={isSelected}
          />
        </View>
      );
    },
    [favoriteReciters, handleReciterPress, itemWidth],
  );

  return (
    <BaseModal
      bottomSheetRef={bottomSheetRef}
      snapPoints={['90%']}
      title="Favorite Reciters"
      onChange={index => {
        if (index === -1) {
          onClose();
        }
      }}>
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <SearchInput
            ref={searchInputRef}
            placeholder="Search reciters..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            backgroundColor={Color(theme.colors.card).alpha(0.5).toString()}
            borderColor={Color(theme.colors.border).alpha(0.1).toString()}
            iconColor={theme.colors.text}
            textColor={theme.colors.text}
            showCancelButton={false}
            containerStyle={styles.searchInputContainer}
            autoCapitalize="none"
            keyboardAppearance={theme.isDarkMode ? 'dark' : 'light'}
          />
        </View>

        <View style={styles.categoriesContainer}>
          <AnimatedTouchableOpacity
            style={[styles.categoryButton, allButtonAnimatedStyle]}
            activeOpacity={0.9}
            onPress={() => handleCategoryPress('all')}
            onPressIn={() => handlePressIn(allButtonScale)}
            onPressOut={() => handlePressOut(allButtonScale)}>
            <Text
              style={[
                styles.categoryText,
                selectedCategory === 'all' && styles.activeCategoryText,
              ]}>
              All Reciters
            </Text>
          </AnimatedTouchableOpacity>

          <AnimatedTouchableOpacity
            style={[styles.categoryButton, favoritesButtonAnimatedStyle]}
            activeOpacity={0.9}
            onPress={() => handleCategoryPress('favorites')}
            onPressIn={() => handlePressIn(favoritesButtonScale)}
            onPressOut={() => handlePressOut(favoritesButtonScale)}>
            <Text
              style={[
                styles.categoryText,
                selectedCategory === 'favorites' && styles.activeCategoryText,
              ]}>
              Favorites
            </Text>
          </AnimatedTouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.resultsContainer}>
          <Text style={styles.resultsText}>
            {filteredReciters.length}{' '}
            {filteredReciters.length === 1 ? 'reciter' : 'reciters'}
          </Text>
        </View>

        <FlatList
          data={filteredReciters}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={numColumns}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.columnWrapper}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon
                name="search"
                type="feather"
                size={moderateScale(50)}
                color={emptyIconColor}
              />
              <Text style={styles.emptyText}>No reciters found</Text>
              <Text style={styles.emptySubtext}>
                Try adjusting your search or filters
              </Text>
            </View>
          }
        />

        <TouchableOpacity
          style={styles.doneButton}
          activeOpacity={0.9}
          onPress={onClose}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </BaseModal>
  );
};

const createStyles = (theme: Theme, dividerColor: string) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    searchContainer: {
      paddingVertical: moderateScale(8),
    },
    searchInputContainer: {
      paddingHorizontal: 0,
      paddingVertical: 0,
      width: '100%',
    },
    categoriesContainer: {
      flexDirection: 'row',
      paddingTop: moderateScale(8),
      paddingBottom: moderateScale(12),
    },
    categoryButton: {
      paddingHorizontal: moderateScale(14),
      paddingVertical: moderateScale(8),
      borderRadius: moderateScale(16),
      marginRight: moderateScale(8),
      borderWidth: 1,
    },
    categoryText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
    activeCategoryText: {
      color: theme.colors.text,
      fontFamily: theme.fonts.medium,
    },
    divider: {
      height: 1,
      backgroundColor: dividerColor,
      marginHorizontal: moderateScale(16),
    },
    resultsContainer: {
      paddingVertical: moderateScale(8),
    },
    resultsText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
    gridContainer: {
      paddingTop: moderateScale(8),
      paddingBottom: moderateScale(80), // Extra padding for the done button
    },
    columnWrapper: {
      justifyContent: 'flex-start',
      gap: moderateScale(8),
    },
    emptyContainer: {
      padding: moderateScale(40),
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      marginTop: moderateScale(16),
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.medium,
      color: theme.colors.text,
      textAlign: 'center',
    },
    emptySubtext: {
      marginTop: moderateScale(8),
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    doneButton: {
      position: 'absolute',
      bottom: moderateScale(20),
      left: moderateScale(16),
      right: moderateScale(16),
      backgroundColor: theme.colors.text,
      paddingVertical: moderateScale(14),
      borderRadius: moderateScale(12),
      alignItems: 'center',
      shadowColor: theme.colors.shadow,
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
    },
    doneButtonText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.background,
    },
  });
