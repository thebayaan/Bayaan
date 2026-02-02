import React, {useEffect, useCallback, useMemo} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import Color from 'color';
import {useDuas} from '@/hooks/useDuas';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {DuaReader} from '@/components/duas/DuaReader';
import {DuaAudioControls} from '@/components/duas/DuaAudioControls';
import {TasbeehCounter} from '@/components/duas/TasbeehCounter';
import {LoadingIndicator} from '@/components/LoadingIndicator';

const DuaDetailScreen: React.FC = () => {
  const {duaId, categoryId} = useLocalSearchParams<{
    duaId: string;
    categoryId?: string;
  }>();
  const router = useRouter();
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);

  const {
    currentDua,
    currentDuaIndex,
    duasInCategory,
    selectedCategory,
    selectCategory,
    setCurrentDua,
    navigateToDua,
    isFavorite,
    toggleFavorite,
    loading,
  } = useDuas();

  // Load category if we have categoryId but no selected category
  useEffect(() => {
    if (categoryId && !selectedCategory) {
      selectCategory(categoryId);
    }
  }, [categoryId, selectedCategory, selectCategory]);

  // Set current dua if we navigated directly with duaId
  useEffect(() => {
    if (duaId && duasInCategory.length > 0 && !currentDua) {
      const index = duasInCategory.findIndex(d => d.id === duaId);
      if (index !== -1) {
        setCurrentDua(duasInCategory[index], index);
      }
    }
  }, [duaId, duasInCategory, currentDua, setCurrentDua]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleFavoriteToggle = useCallback(() => {
    if (currentDua) {
      toggleFavorite(currentDua.id);
    }
  }, [currentDua, toggleFavorite]);

  const handlePrevious = useCallback(() => {
    navigateToDua('prev');
  }, [navigateToDua]);

  const handleNext = useCallback(() => {
    navigateToDua('next');
  }, [navigateToDua]);

  // Memoize whether current dua is favorited
  const isCurrentFavorite = useMemo(() => {
    return currentDua ? isFavorite(currentDua.id) : false;
  }, [currentDua, isFavorite]);

  // Determine if navigation buttons should show
  const canNavigate = duasInCategory.length > 1;
  const totalDuas = duasInCategory.length;

  // Handle loading state
  if (!duaId) {
    return null;
  }

  if (loading || !currentDua) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <LoadingIndicator />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon
              name="arrow-left"
              type="feather"
              size={moderateScale(24)}
              color={theme.colors.text}
            />
          </TouchableOpacity>

          {/* Title with position */}
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {selectedCategory?.title || 'Dua'}
            </Text>
            {totalDuas > 1 ? (
              <Text style={styles.positionText}>
                {currentDuaIndex + 1} of {totalDuas}
              </Text>
            ) : null}
          </View>

          {/* Navigation Buttons */}
          {canNavigate ? (
            <View style={styles.navButtonsContainer}>
              <TouchableOpacity
                style={styles.navButton}
                onPress={handlePrevious}
                activeOpacity={0.7}
                hitSlop={{top: 10, bottom: 10, left: 5, right: 5}}>
                <Icon
                  name="chevron-left"
                  type="feather"
                  size={moderateScale(22)}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navButton}
                onPress={handleNext}
                activeOpacity={0.7}
                hitSlop={{top: 10, bottom: 10, left: 5, right: 5}}>
                <Icon
                  name="chevron-right"
                  type="feather"
                  size={moderateScale(22)}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.navPlaceholder} />
          )}
        </View>
      </SafeAreaView>

      {/* Main Content */}
      <View style={styles.contentContainer}>
        {/* Dua Reader */}
        <DuaReader
          dua={currentDua}
          isFavorite={isCurrentFavorite}
          onFavoriteToggle={handleFavoriteToggle}
        />

        {/* Tasbeeh Counter - only show if repeatCount > 1 */}
        {currentDua.repeatCount > 1 ? (
          <View style={styles.tasbeehContainer}>
            <TasbeehCounter
              duaId={currentDua.id}
              targetCount={currentDua.repeatCount}
            />
          </View>
        ) : null}
      </View>

      {/* Audio Controls at bottom */}
      <View
        style={[styles.audioControlsContainer, {paddingBottom: insets.bottom}]}>
        <DuaAudioControls audioFile={currentDua.audioFile} />
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerSafeArea: {
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.border).alpha(0.2).toString(),
    },
    header: {
      height: moderateScale(56),
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(16),
    },
    backButton: {
      padding: moderateScale(8),
      marginRight: moderateScale(8),
    },
    titleContainer: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
    },
    positionText: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      marginTop: moderateScale(2),
    },
    navButtonsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
    },
    navButton: {
      padding: moderateScale(8),
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(8),
    },
    navPlaceholder: {
      width: moderateScale(80),
    },
    contentContainer: {
      flex: 1,
    },
    tasbeehContainer: {
      paddingHorizontal: moderateScale(20),
    },
    audioControlsContainer: {
      paddingHorizontal: moderateScale(16),
      paddingTop: moderateScale(12),
      backgroundColor: theme.colors.background,
      borderTopWidth: 1,
      borderTopColor: Color(theme.colors.border).alpha(0.2).toString(),
    },
  });

export default DuaDetailScreen;
