import React, {useState, useCallback, useMemo, useRef} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  Pressable,
  TextInput,
  Dimensions,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {RECITERS, Reciter} from '@/data/reciterData';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import ActionSheet, {SheetProps} from 'react-native-actions-sheet';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {SearchInput} from '@/components/SearchInput';
import {ReciterImage} from '@/components/ReciterImage';
import {Icon} from '@rneui/themed';

export const FavoriteRecitersSheet = (
  props: SheetProps<'favorite-reciters'>,
) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {toggleFavorite, favoriteReciters} = useFavoriteReciters();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  const favoriteIds = useMemo(
    () => new Set(favoriteReciters.map(r => r.id)),
    [favoriteReciters],
  );

  const filteredReciters = useMemo(() => {
    if (!searchQuery.trim()) return RECITERS;

    const query = searchQuery.toLowerCase().trim();
    return RECITERS.filter(reciter => {
      if (reciter.name.toLowerCase().includes(query)) return true;
      return reciter.rewayat.some(rewaya =>
        rewaya.name?.toLowerCase().includes(query),
      );
    });
  }, [searchQuery]);

  const handleReciterPress = useCallback(
    (reciter: Reciter) => {
      toggleFavorite(reciter);
    },
    [toggleFavorite],
  );

  const renderItem = useCallback(
    ({item}: {item: Reciter}) => {
      const isFavorite = favoriteIds.has(item.id);

      return (
        <Pressable
          style={({pressed}) => [
            styles.reciterRow,
            pressed && styles.reciterRowPressed,
          ]}
          onPress={() => handleReciterPress(item)}>
          <View style={styles.reciterImageContainer}>
            <ReciterImage
              imageUrl={item.image_url || undefined}
              reciterName={item.name}
              style={styles.reciterImage}
              profileIconSize={moderateScale(20)}
            />
          </View>
          <View style={styles.reciterInfo}>
            <Text style={styles.reciterName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.reciterDetail} numberOfLines={1}>
              {item.rewayat.length > 1
                ? `${item.rewayat.length} rewayat`
                : item.rewayat[0]?.name || ''}
            </Text>
          </View>
          <View
            style={[
              styles.checkCircle,
              isFavorite && styles.checkCircleActive,
            ]}>
            {isFavorite && (
              <Icon
                name="check"
                type="feather"
                size={moderateScale(14)}
                color={theme.colors.text}
              />
            )}
          </View>
        </Pressable>
      );
    },
    [favoriteIds, handleReciterPress, styles, theme.colors.text],
  );

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Favorite Reciters</Text>
        <Text style={styles.headerSubtitle}>
          {favoriteReciters.length} selected
        </Text>
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
            iconColor={theme.colors.textSecondary}
            textColor={theme.colors.text}
            showCancelButton={false}
            containerStyle={styles.searchInputContainer}
            autoCapitalize="none"
            keyboardAppearance={theme.isDarkMode ? 'dark' : 'light'}
          />
        </View>

        <FlatList
          data={filteredReciters}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No reciters found</Text>
            </View>
          }
        />
      </View>
    </ActionSheet>
  );
};

const SCREEN_HEIGHT = Dimensions.get('window').height;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
      height: SCREEN_HEIGHT * 0.85,
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
    },
    header: {
      alignItems: 'center',
      paddingVertical: moderateScale(12),
      gap: moderateScale(4),
    },
    headerTitle: {
      fontSize: moderateScale(20),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    headerSubtitle: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    container: {
      flex: 1,
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
    listContainer: {
      paddingTop: moderateScale(4),
      paddingBottom: moderateScale(40),
      gap: moderateScale(6),
    },
    reciterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(5),
      paddingHorizontal: moderateScale(14),
      borderRadius: moderateScale(12),
    },
    reciterRowPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    reciterImageContainer: {
      width: moderateScale(46),
      height: moderateScale(46),
      borderRadius: moderateScale(23),
      overflow: 'hidden',
      marginRight: moderateScale(12),
    },
    reciterImage: {
      width: moderateScale(46),
      height: moderateScale(46),
    },
    reciterInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    reciterName: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginBottom: moderateScale(2),
    },
    reciterDetail: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
    },
    checkCircle: {
      width: moderateScale(26),
      height: moderateScale(26),
      borderRadius: moderateScale(13),
      borderWidth: moderateScale(1.5),
      borderColor: Color(theme.colors.text).alpha(0.12).toString(),
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: moderateScale(8),
    },
    checkCircleActive: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderColor: Color(theme.colors.text).alpha(0.12).toString(),
    },
    emptyContainer: {
      padding: moderateScale(40),
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });
