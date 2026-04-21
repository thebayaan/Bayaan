import React, {useState, useMemo} from 'react';
import {View, Text, ScrollView, Pressable, Alert} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {useStorageBreakdown} from '@/hooks/useStorageBreakdown';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {clearPlayerCache} from '@/services/player/utils/storage';
import {Feather} from '@expo/vector-icons';

interface StorageCategoryProps {
  color: string;
  label: string;
  size: string;
  styles: ReturnType<typeof createStyles>;
}

const StorageCategory = ({
  color,
  label,
  size,
  styles,
}: StorageCategoryProps) => (
  <View style={styles.categoryRow}>
    <View style={[styles.dot, {backgroundColor: color}]} />
    <Text style={styles.categoryLabel}>{label}</Text>
    <Text style={styles.categorySize}>{size}</Text>
  </View>
);

interface ActionSectionProps {
  title: string;
  description: string;
  buttonLabel: string;
  onPress: () => void;
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
}

const ActionSection = ({
  title,
  description,
  buttonLabel,
  onPress,
  theme,
  styles,
}: ActionSectionProps) => (
  <View style={styles.actionSection}>
    <View style={styles.actionContent}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionDescription}>{description}</Text>
    </View>
    <Pressable
      style={({pressed}) => [
        styles.actionButton,
        {backgroundColor: theme.colors.text},
        pressed && {opacity: 0.8},
      ]}
      onPress={onPress}>
      <Text style={styles.actionButtonText}>{buttonLabel}</Text>
    </Pressable>
  </View>
);

export default function StorageScreen() {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
              await clearPlayerCache();
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

  const totalRaw = rawData.total || 1;
  let otherAppsPercentage = (rawData.otherApps / totalRaw) * 100;
  let downloadsPercentage = (rawData.downloads / totalRaw) * 100;
  let cachePercentage = (rawData.cache / totalRaw) * 100;
  let freePercentage = (rawData.free / totalRaw) * 100;

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

  const colors = {
    downloads: '#34C759',
    cache: '#8E8E93',
    otherApps: '#007AFF',
    free: '#E5E5EA',
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>
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
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            {/* Storage Breakdown */}
            <Text style={styles.sectionHeader}>STORAGE BREAKDOWN</Text>

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

            <View style={styles.breakdownContainer}>
              <StorageCategory
                color={colors.otherApps}
                label="Other apps"
                size={otherApps}
                styles={styles}
              />
              <StorageCategory
                color={colors.downloads}
                label="Downloads"
                size={downloads}
                styles={styles}
              />
              <StorageCategory
                color={colors.cache}
                label="Cache"
                size={cache}
                styles={styles}
              />
              <StorageCategory
                color={colors.free}
                label="Free"
                size={free}
                styles={styles}
              />
            </View>

            {/* Manage Storage */}
            <Text style={styles.sectionHeader}>MANAGE STORAGE</Text>
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
    sectionHeader: {
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: moderateScale(10),
      marginLeft: moderateScale(2),
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(60),
    },
    loadingText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
    },
    errorContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(60),
      gap: moderateScale(16),
    },
    errorText: {
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.text).alpha(0.85).toString(),
    },
    progressContainer: {
      marginBottom: moderateScale(24),
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
      marginBottom: moderateScale(32),
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
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.text).alpha(0.85).toString(),
    },
    categorySize: {
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.text).alpha(0.85).toString(),
    },
    actionSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: moderateScale(16),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderRadius: moderateScale(14),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      gap: moderateScale(16),
    },
    actionContent: {
      flex: 1,
    },
    actionTitle: {
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.85).toString(),
      marginBottom: moderateScale(4),
    },
    actionDescription: {
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      lineHeight: moderateScale(17),
    },
    actionButton: {
      paddingHorizontal: moderateScale(20),
      paddingVertical: moderateScale(10),
      borderRadius: moderateScale(8),
    },
    actionButtonText: {
      color: theme.colors.background,
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
    },
    actionSpacer: {
      height: moderateScale(12),
    },
  });
