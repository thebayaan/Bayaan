import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Platform,
  Keyboard,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {SurahItem} from '@/components/SurahItem';
import {Surah} from '@/data/surahData';
import {RewayatStyle} from '@/types/reciter';
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated';
import Color from 'color';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {SearchInput} from '@/components/SearchInput';
import {BlurView} from '@react-native-community/blur';
import {StyleSheet} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {SurahCard} from '@/components/cards/SurahCard';

// Define view mode type
type ReciterProfileViewMode = 'card' | 'list';

interface SearchViewProps {
  surahs: Surah[];
  onSurahPress: (surah: Surah) => void;
  reciterId: string;
  isLoved: (reciterId: string, surahId: string) => boolean;
  onOptionsPress: (surah: Surah) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCloseSearch: () => void;
  availableRewayat: RewayatStyle[];
  selectedRewayatId?: string;
  onRewayatSelect: (id: string) => void;
  isDarkMode: boolean;
  reciterName: string;
  viewMode: ReciterProfileViewMode;
  getColorForSurah: (id: number) => string;
}

export const SearchView: React.FC<SearchViewProps> = ({
  surahs,
  onSurahPress,
  reciterId,
  isLoved,
  onOptionsPress,
  searchQuery,
  onSearchChange,
  onCloseSearch,
  availableRewayat,
  selectedRewayatId,
  onRewayatSelect,
  isDarkMode,
  reciterName,
  viewMode,
  getColorForSurah,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();

  // Render list item
  const renderListItem = React.useCallback(
    ({item}: {item: Surah}) => (
      <SurahItem
        item={item}
        onPress={surah => {
          Keyboard.dismiss();
          onSurahPress(surah);
        }}
        reciterId={reciterId}
        isLoved={isLoved(reciterId, item.id.toString())}
        onOptionsPress={onOptionsPress}
        rewayatId={selectedRewayatId}
      />
    ),
    [onSurahPress, reciterId, isLoved, onOptionsPress, selectedRewayatId],
  );

  // Render card item
  const renderCardItem = React.useCallback(
    ({item}: {item: Surah}) => (
      <SurahCard
        id={item.id}
        name={item.name}
        translatedName={item.translated_name_english}
        versesCount={item.verses_count}
        revelationPlace={item.revelation_place}
        color={getColorForSurah(item.id)}
        onPress={() => {
          Keyboard.dismiss();
          onSurahPress(item);
        }}
        style={styles.surahCard}
        isLoved={isLoved(reciterId, item.id.toString())}
        onOptionsPress={() => onOptionsPress && onOptionsPress(item)}
        reciterId={reciterId}
        rewayatId={selectedRewayatId}
      />
    ),
    [
      getColorForSurah,
      onSurahPress,
      styles.surahCard,
      isLoved,
      reciterId,
      onOptionsPress,
      selectedRewayatId,
    ],
  );

  // Memoize the Rewayat List Header
  const ListHeader = React.useMemo(
    () => (
      <FlatList
        data={availableRewayat}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rewayatList}
        keyboardShouldPersistTaps="handled"
        renderItem={({item}) => (
          <TouchableOpacity
            style={[
              styles.rewayatButton,
              selectedRewayatId === item.id && styles.selectedRewayatButton,
            ]}
            onPress={() => onRewayatSelect(item.id)}
            activeOpacity={0.7}>
            <View style={styles.rewayatButtonContent}>
              <Text
                style={[
                  styles.rewayatButtonText,
                  selectedRewayatId === item.id &&
                    styles.selectedRewayatButtonText,
                ]}>
                {item.name}
              </Text>
              <Text
                style={[
                  styles.rewayatButtonSubText,
                  selectedRewayatId === item.id &&
                    styles.selectedRewayatButtonSubText,
                ]}>
                {item.style}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        keyExtractor={item => item.id}
      />
    ),
    [availableRewayat, selectedRewayatId, onRewayatSelect, styles],
  );

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <View style={[styles.headerContainer, {paddingTop: insets.top}]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            blurAmount={80}
            blurType={theme.isDarkMode ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}>
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: Color(theme.colors.card)
                    .alpha(0.7)
                    .toString(),
                },
              ]}
            />
          </BlurView>
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: theme.colors.card,
                opacity: 0.95,
              },
            ]}
          />
        )}
        <Text style={[styles.reciterName, {color: theme.colors.text}]}>
          {reciterName}
        </Text>
        <View style={styles.searchBoxContainer}>
          <SearchInput
            placeholder="Search surahs"
            value={searchQuery}
            onChangeText={onSearchChange}
            onCancel={onCloseSearch}
            iconColor={theme.colors.text}
            textColor={theme.colors.text}
            backgroundColor={Color(theme.colors.card).alpha(0.5).toString()}
            borderColor={Color(theme.colors.border).alpha(0.2).toString()}
            keyboardAppearance={theme.isDarkMode ? 'dark' : 'light'}
            autoCorrect={false}
            autoComplete="off"
            autoCapitalize="none"
          />
        </View>
      </View>

      <View style={styles.contentContainer}>
        <FlatList
          data={surahs}
          renderItem={viewMode === 'card' ? renderCardItem : renderListItem}
          keyExtractor={item => `${viewMode}-${item.id}`}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={ListHeader}
          onScrollBeginDrag={() => Keyboard.dismiss()}
          contentContainerStyle={[
            styles.listContentContainer,
            {paddingBottom: insets.bottom + moderateScale(70)},
          ]}
          numColumns={viewMode === 'card' ? 2 : 1}
          columnWrapperStyle={
            viewMode === 'card' ? styles.columnWrapper : undefined
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text
                style={[styles.emptyText, {color: theme.colors.textSecondary}]}>
                No surahs found
              </Text>
            </View>
          }
          initialNumToRender={viewMode === 'card' ? 10 : 15}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
        />
      </View>
    </Animated.View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
    },
    headerContainer: {
      overflow: 'hidden',
    },
    reciterName: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.bold,
      textAlign: 'center',
      marginBottom: moderateScale(4),
      marginTop: moderateScale(12),
    },
    searchBoxContainer: {
      paddingBottom: moderateScale(12),
      paddingTop: moderateScale(4),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    rewayatList: {
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(12),
      gap: moderateScale(8),
      backgroundColor: theme.colors.background,
    },
    rewayatButton: {
      minWidth: moderateScale(90),
      paddingVertical: moderateScale(8),
      paddingHorizontal: moderateScale(12),
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.08).toString(),
      borderWidth: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    selectedRewayatButton: {
      backgroundColor: theme.colors.text,
    },
    rewayatButtonContent: {
      alignItems: 'center',
    },
    rewayatButtonText: {
      fontSize: moderateScale(11),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
      textAlign: 'center',
    },
    selectedRewayatButtonText: {
      color: theme.colors.background,
      fontFamily: theme.fonts.bold,
    },
    rewayatButtonSubText: {
      fontSize: moderateScale(9),
      fontFamily: theme.fonts.medium,
      color: theme.colors.textSecondary,
      marginTop: moderateScale(1),
      textAlign: 'center',
      textTransform: 'capitalize',
    },
    selectedRewayatButtonSubText: {
      color: Color(theme.colors.background).alpha(0.7).toString(),
      fontFamily: theme.fonts.medium,
    },
    contentContainer: {
      flex: 1,
    },
    listContentContainer: {},
    columnWrapper: {
      justifyContent: 'space-between',
      marginBottom: moderateScale(16),
      paddingHorizontal: moderateScale(16),
    },
    surahCard: {
      width: '47%',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: moderateScale(40),
    },
    emptyText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.medium,
    },
  });
