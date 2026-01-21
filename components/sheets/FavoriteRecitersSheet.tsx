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
  Dimensions,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {CircularReciterCard} from '@/components/cards/CircularReciterCard';
import {RECITERS, Reciter} from '@/data/reciterData';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import ActionSheet, {
  SheetProps,
  SheetManager,
} from 'react-native-actions-sheet';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {SearchInput} from '@/components/SearchInput';
import {Icon} from '@rneui/themed';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

export const FavoriteRecitersSheet = (
  props: SheetProps<'favorite-reciters'>,
) => {
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

  const allButtonScale = useSharedValue(1);
  const favoritesButtonScale = useSharedValue(1);

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

  const emptyIconColor = useMemo(
    () => Color(theme.colors.text).alpha(0.3).toString(),
    [theme.colors.text],
  );

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

  const numColumns = useMemo(() => {
    const minCardWidth = moderateScale(95);
    return Math.max(3, Math.floor((width - moderateScale(32)) / minCardWidth));
  }, [width]);

  const filteredReciters = useMemo(() => {
    let result = [...RECITERS];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(reciter => {
        if (reciter.name.toLowerCase().includes(query)) return true;
        return reciter.rewayat.some(rewaya =>
          rewaya.name?.toLowerCase().includes(query),
        );
      });
    }

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

  const itemWidth = useMemo(() => {
    const totalHorizontalPadding = moderateScale(32);
    const gapSpace = moderateScale(8) * (numColumns - 1);
    const availableWidth = width - totalHorizontalPadding - gapSpace;
    return availableWidth / numColumns;
  }, [width, numColumns]);

  const handleClose = useCallback(() => {
    SheetManager.hide('favorite-reciters');
  }, []);

  const renderItem = useCallback(
    ({item}: {item: Reciter}) => {
      const isSelected = favoriteReciters.some(
        reciter => reciter.id === item.id,
      );

      const cardSize = itemWidth * 0.85;

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
    <ActionSheet
      id={props.sheetId}
      containerStyle={[
        styles.sheetContainer,
        {backgroundColor: theme.colors.background},
      ]}
      indicatorStyle={[
        styles.indicator,
        {backgroundColor: Color(theme.colors.text).alpha(0.3).toString()},
      ]}
      gestureEnabled={true}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Favorite Reciters</Text>
      </View>
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
          onPress={handleClose}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </ActionSheet>
  );
};

const SCREEN_HEIGHT = Dimensions.get('window').height;

const createStyles = (theme: Theme, dividerColor: string) =>
  StyleSheet.create({
    sheetContainer: {
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
      height: SCREEN_HEIGHT * 0.85,
    },
    indicator: {
      width: moderateScale(40),
    },
    headerContainer: {
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    headerTitle: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    container: {
      height: '100%',
      paddingHorizontal: moderateScale(16),
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
      paddingBottom: moderateScale(80),
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
