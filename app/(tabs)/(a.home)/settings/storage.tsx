import React, {useState} from 'react';
import {View, Text, ScrollView, TouchableOpacity, Alert} from 'react-native';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Header from '@/components/Header';
import {useStorageBreakdown} from '@/hooks/useStorageBreakdown';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {clearPlayerCache} from '@/services/player/utils/storage';
import {Feather} from '@expo/vector-icons';

interface StorageCategoryProps {
  color: string;
  label: string;
  size: string;
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
}

const StorageCategory = ({
  color,
  label,
  size,
  theme,
  styles,
}: StorageCategoryProps) => (
  <View style={styles.categoryRow}>
    <View style={[styles.dot, {backgroundColor: color}]} />
    <Text style={[styles.categoryLabel, {color: theme.colors.text}]}>
      {label}
    </Text>
    <Text style={[styles.categorySize, {color: theme.colors.text}]}>
      {size}
    </Text>
  </View>
);

const ActionSection = ({
  title,
  description,
  buttonLabel,
  onPress,
  theme,
  styles,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  onPress: () => void;
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
}) => (
  <View style={styles.actionSection}>
    <View style={styles.actionContent}>
      <Text style={[styles.actionTitle, {color: theme.colors.text}]}>
        {title}
      </Text>
      <Text
        style={[styles.actionDescription, {color: theme.colors.textSecondary}]}>
        {description}
      </Text>
    </View>
    <TouchableOpacity
      style={[styles.actionButton, {backgroundColor: theme.colors.text}]}
      onPress={onPress}
      activeOpacity={0.7}>
      <Text style={styles.actionButtonText}>{buttonLabel}</Text>
    </TouchableOpacity>
  </View>
);

export default function StorageScreen() {
  const {theme} = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);
  const [, setIsClearing] = useState(false);

  const {free, downloads, cache, otherApps, loading, error, rawData, refresh} =
    useStorageBreakdown();

  const handleClearAllDownloads = () => {
    Alert.alert(
      'Remove all downloads',
      'Are you sure you want to remove all downloaded content? This action cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsClearing(true);
              await useDownloadStore.getState().clearAllDownloads();
              // Refresh storage breakdown
              refresh();
              Alert.alert('Success', 'All downloads have been removed.');
            } catch (downloadError) {
              Alert.alert('Error', 'Failed to remove downloads.');
            } finally {
              setIsClearing(false);
            }
          },
        },
      ],
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear cache',
      "This will clear your cache. Your downloads won't be removed.",
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsClearing(true);
              // Clear both AsyncStorage cache AND file system cache
              await clearPlayerCache();
              //   await clearCacheDirectory();
              // Refresh storage breakdown
              refresh();
              Alert.alert('Success', 'Cache has been cleared.');
            } catch (cacheError) {
              Alert.alert('Error', 'Failed to clear cache.');
            } finally {
              setIsClearing(false);
            }
          },
        },
      ],
    );
  };

  // Calculate progress percentages for each category
  const totalRaw = rawData.total || 1;
  let otherAppsPercentage = (rawData.otherApps / totalRaw) * 100;
  let downloadsPercentage = (rawData.downloads / totalRaw) * 100;
  let cachePercentage = (rawData.cache / totalRaw) * 100;
  let freePercentage = (rawData.free / totalRaw) * 100;

  console.log('[StorageScreen] Raw percentages:', {
    otherApps: otherAppsPercentage.toFixed(2) + '%',
    downloads: downloadsPercentage.toFixed(2) + '%',
    cache: cachePercentage.toFixed(2) + '%',
    free: freePercentage.toFixed(2) + '%',
  });

  // Ensure minimum 2% width for small segments so they're visible
  const MIN_PERCENTAGE = 2;
  if (downloadsPercentage > 0 && downloadsPercentage < MIN_PERCENTAGE) {
    downloadsPercentage = MIN_PERCENTAGE;
    otherAppsPercentage = Math.max(
      0,
      100 - downloadsPercentage - cachePercentage - freePercentage,
    );
  }
  if (cachePercentage > 0 && cachePercentage < MIN_PERCENTAGE) {
    cachePercentage = MIN_PERCENTAGE;
    otherAppsPercentage = Math.max(
      0,
      100 - downloadsPercentage - cachePercentage - freePercentage,
    );
  }
  // Recalculate to ensure total is 100%
  const totalPercentage =
    otherAppsPercentage +
    downloadsPercentage +
    cachePercentage +
    freePercentage;
  if (totalPercentage > 100) {
    const scale = 100 / totalPercentage;
    otherAppsPercentage *= scale;
    downloadsPercentage *= scale;
    cachePercentage *= scale;
    freePercentage *= scale;
  }

  console.log('[StorageScreen] Final percentages:', {
    otherApps: otherAppsPercentage.toFixed(2) + '%',
    downloads: downloadsPercentage.toFixed(2) + '%',
    cache: cachePercentage.toFixed(2) + '%',
    free: freePercentage.toFixed(2) + '%',
  });

  // Define colors for each category
  const colors = {
    downloads: '#34C759', // Green
    cache: '#8E8E93', // Grey
    otherApps: '#007AFF', // Blue
    free: '#E5E5EA', // Light grey
  };

  return (
    <View style={styles.container}>
      <Header title="Storage" onBack={() => router.back()} />

      <ScrollView
        style={[styles.content, {paddingTop: insets.top + moderateScale(56)}]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text
              style={[styles.loadingText, {color: theme.colors.textSecondary}]}>
              Loading storage information...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Feather
              name="alert-circle"
              size={moderateScale(48)}
              color={theme.colors.error}
            />
            <Text style={[styles.errorText, {color: theme.colors.text}]}>
              {error}
            </Text>
          </View>
        ) : (
          <>
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressSegment,
                    {
                      width: `${otherAppsPercentage}%`,
                      backgroundColor: colors.otherApps,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.progressSegment,
                    {
                      width: `${downloadsPercentage}%`,
                      backgroundColor: colors.downloads,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.progressSegment,
                    {
                      width: `${cachePercentage}%`,
                      backgroundColor: colors.cache,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.progressSegment,
                    {
                      width: `${freePercentage}%`,
                      backgroundColor: colors.free,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Storage Breakdown */}
            <View style={styles.breakdownContainer}>
              <StorageCategory
                color={colors.otherApps}
                label="Other apps"
                size={otherApps}
                theme={theme}
                styles={styles}
              />
              <StorageCategory
                color={colors.downloads}
                label="Downloads"
                size={downloads}
                theme={theme}
                styles={styles}
              />
              <StorageCategory
                color={colors.cache}
                label="Cache"
                size={cache}
                theme={theme}
                styles={styles}
              />
              <StorageCategory
                color={colors.free}
                label="Free"
                size={free}
                theme={theme}
                styles={styles}
              />
            </View>

            {/* Action Sections */}
            <View>
              <ActionSection
                title="Remove all downloads"
                description="Remove all the Quran content you have downloaded for offline use."
                buttonLabel="Remove"
                onPress={handleClearAllDownloads}
                theme={theme}
                styles={styles}
                key="downloads"
              />

              <View style={styles.actionSpacer} />

              <ActionSection
                title="Clear cache"
                description="You can free up storage by clearing your cache. Your downloads won't be removed."
                buttonLabel="Clear"
                onPress={handleClearCache}
                theme={theme}
                styles={styles}
                key="cache"
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: moderateScale(24),
      paddingVertical: moderateScale(20),
      paddingBottom: moderateScale(160),
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(60),
    },
    loadingText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
    },
    errorContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(60),
      gap: moderateScale(16),
    },
    errorText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.medium,
    },
    progressContainer: {
      marginBottom: moderateScale(32),
    },
    progressBarContainer: {
      height: moderateScale(8),
      borderRadius: moderateScale(4),
      flexDirection: 'row',
      overflow: 'hidden',
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
    },
    progressSegment: {
      height: '100%',
    },
    breakdownContainer: {
      gap: moderateScale(16),
      marginBottom: moderateScale(40),
    },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(12),
    },
    dot: {
      width: moderateScale(10),
      height: moderateScale(10),
      borderRadius: moderateScale(5),
    },
    categoryLabel: {
      flex: 1,
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.regular,
    },
    categorySize: {
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.medium,
    },
    actionSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: moderateScale(16),
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(12),
      gap: moderateScale(16),
    },
    actionContent: {
      flex: 1,
    },
    actionTitle: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      marginBottom: moderateScale(4),
    },
    actionDescription: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.regular,
      lineHeight: moderateScale(18),
    },
    actionButton: {
      paddingHorizontal: moderateScale(20),
      paddingVertical: moderateScale(10),
      borderRadius: moderateScale(8),
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
    },
    actionSpacer: {
      height: moderateScale(12),
    },
  });
