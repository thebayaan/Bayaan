import React from 'react';
import {View, Text, TouchableOpacity, FlatList, Platform} from 'react-native';
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
import {LinearGradient} from 'expo-linear-gradient';
import {StyleSheet} from 'react-native';
import {StatusBar} from 'expo-status-bar';

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
  dominantColors: {
    primary: string;
    secondary: string;
  };
  isDarkMode: boolean;
  reciterName: string;
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
  dominantColors,
  isDarkMode,
  reciterName,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();

  const renderSurahItem = React.useCallback(
    ({item}: {item: Surah}) => (
      <SurahItem
        item={item}
        onPress={onSurahPress}
        reciterId={reciterId}
        isLoved={isLoved(reciterId, item.id.toString())}
        onOptionsPress={onOptionsPress}
      />
    ),
    [onSurahPress, reciterId, isLoved, onOptionsPress],
  );

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.headerContainer}>
        {Platform.OS === 'ios' ? (
          <BlurView
            blurAmount={100}
            blurType={isDarkMode ? 'dark' : 'light'}
            style={[StyleSheet.absoluteFill, {paddingTop: insets.top}]}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDarkMode
                  ? 'rgba(0,0,0,0.8)'
                  : 'rgba(255,255,255,0.9)',
                paddingTop: insets.top,
              },
            ]}
          />
        )}
        <LinearGradient
          colors={[dominantColors.primary, dominantColors.secondary]}
          style={[StyleSheet.absoluteFill, styles.gradient]}
          start={{x: 0, y: 0}}
          end={{x: 0, y: 1}}
        />
        <View style={[styles.headerContent, {paddingTop: insets.top}]}>
          <Text style={styles.reciterName}>{reciterName}</Text>
          <SearchInput
            value={searchQuery}
            onChangeText={onSearchChange}
            onCancel={onCloseSearch}
            placeholder="Search Surahs"
            autoFocus={true}
            iconColor="white"
            textColor="white"
            backgroundColor={Color('white').alpha(0.15).toString()}
            borderColor={Color('white').alpha(0.2).toString()}
            iconSize={moderateScale(18)}
            keyboardAppearance={isDarkMode ? 'dark' : 'light'}
            autoCorrect={false}
            autoCapitalize="none"
            keyboardShouldPersistTaps="handled"
          />

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
                <View>
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
                        styles.selectedRewayatButtonText,
                    ]}>
                    {item.style}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={item => item.id}
          />
        </View>
      </View>

      <View style={styles.contentContainer}>
        <FlatList
          data={surahs}
          renderItem={renderSurahItem}
          keyExtractor={item => item.id.toString()}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.surahList,
            {paddingBottom: insets.bottom + moderateScale(70)},
          ]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No surahs found</Text>
            </View>
          }
        />
      </View>
    </Animated.View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerContainer: {
      overflow: 'hidden',
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    gradient: {
      opacity: 0.9,
    },
    headerContent: {
      paddingBottom: moderateScale(8),
    },
    reciterName: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.bold,
      color: 'white',
      textAlign: 'center',
      marginBottom: moderateScale(4),
    },
    rewayatList: {
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(4),
      gap: moderateScale(6),
    },
    rewayatButton: {
      paddingHorizontal: moderateScale(8),
      paddingVertical: moderateScale(6),
      borderRadius: moderateScale(8),
      backgroundColor: Color('white').alpha(0.15).toString(),
      borderWidth: 1,
      borderColor: Color('white').alpha(0.2).toString(),
      minWidth: moderateScale(100),
    },
    selectedRewayatButton: {
      backgroundColor: Color('white').alpha(0.25).toString(),
      borderColor: 'white',
    },
    rewayatButtonText: {
      fontSize: moderateScale(11),
      fontFamily: theme.fonts.medium,
      color: 'white',
      opacity: 0.8,
    },
    rewayatButtonSubText: {
      fontSize: moderateScale(9),
      fontFamily: theme.fonts.regular,
      color: 'white',
      opacity: 0.6,
      marginTop: moderateScale(1),
      textTransform: 'capitalize',
    },
    selectedRewayatButtonText: {
      color: 'white',
      fontFamily: theme.fonts.bold,
      opacity: 1,
    },
    contentContainer: {
      flex: 1,
    },
    surahList: {
      paddingTop: moderateScale(8),
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
      color: theme.colors.textSecondary,
    },
  });
