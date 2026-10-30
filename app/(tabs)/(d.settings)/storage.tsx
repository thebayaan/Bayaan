import React, {useState} from 'react';
import {View, Text, ScrollView, Alert, StyleSheet} from 'react-native';
import {confirmDestructive} from '@/utils/confirmDestructive'; // @ai
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {useStorageBreakdown} from '@/hooks/useStorageBreakdown';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {clearPlayerCache} from '@/services/player/utils/storage';
import {Feather} from '@expo/vector-icons';
// @ai-start
import {useTranslation} from 'react-i18next';
import {localizeDigits} from '@/i18n/format';
import {
  SettingsRow,
  SettingsSection,
  useSettingsStyles,
} from '@/components/settings/SettingsList';
// @ai-end

// @ai-start
export default function StorageScreen() {
  const {theme} = useTheme();
  const {t} = useTranslation(['settings', 'common']);
  const styles = useSettingsStyles(); // @ai
  const [isClearing, setIsClearing] = useState(false);

  const {free, downloads, cache, otherApps, loading, error, rawData, refresh} =
    useStorageBreakdown();

  const handleClearAllDownloads = () => {
    if (isClearing) return;
    confirmDestructive({
      title: t('storage.removeDownloadsTitle'),
      message: t('storage.removeDownloadsConfirm'),
      confirmText: t('common:actions.remove'),
      cancelText: t('common:actions.cancel'),
      onConfirm: async () => {
        try {
          setIsClearing(true);
          await useDownloadStore.getState().clearAllDownloads();
          refresh();
          Alert.alert(
            t('storage.success'),
            t('storage.removeDownloadsSuccess'),
          );
        } catch (downloadError) {
          Alert.alert(t('storage.error'), t('storage.removeDownloadsError'));
        } finally {
          setIsClearing(false);
        }
      },
    });
  };

  const handleClearCache = () => {
    if (isClearing) return;
    confirmDestructive({
      title: t('storage.clearCacheTitle'),
      message: t('storage.clearCacheConfirm'),
      confirmText: t('common:actions.clear'),
      cancelText: t('common:actions.cancel'),
      onConfirm: async () => {
        try {
          setIsClearing(true);
          await clearPlayerCache();
          refresh();
          Alert.alert(t('storage.success'), t('storage.clearCacheSuccess'));
        } catch (cacheError) {
          Alert.alert(t('storage.error'), t('storage.clearCacheError'));
        } finally {
          setIsClearing(false);
        }
      },
    });
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

  const dot = (color: string) => (
    <View style={[local.dot, {backgroundColor: color}]} />
  );
  const segment = (percent: number, color: string) => (
    <View
      style={[local.segment, {width: `${percent}%`, backgroundColor: color}]}
    />
  );

  return (
    <View style={{flex: 1, backgroundColor: theme.colors.background}}>
      <ScrollView
        contentContainerStyle={styles.page}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text
            style={[
              local.status,
              {
                color: theme.colors.textSecondary,
                fontSize: theme.typography.mediumSize,
              },
            ]}>
            {t('storage.loading')}
          </Text>
        ) : error ? (
          <View style={local.errorContainer}>
            <Feather
              name="alert-circle"
              size={moderateScale(48)}
              color={theme.colors.error}
            />
            <Text
              style={[
                local.status,
                {
                  color: theme.colors.error,
                  fontSize: theme.typography.mediumSize,
                },
              ]}>
              {error}
            </Text>
          </View>
        ) : (
          <>
            <SettingsSection title={t('storage.breakdownHeader')}>
              <View style={local.barRow}>
                <View style={local.bar}>
                  {segment(otherAppsPercentage, colors.otherApps)}
                  {segment(downloadsPercentage, colors.downloads)}
                  {segment(cachePercentage, colors.cache)}
                  {segment(freePercentage, colors.free)}
                </View>
              </View>
              <SettingsRow
                icon={dot(colors.otherApps)}
                title={t('storage.otherApps')}
                value={localizeDigits(otherApps)}
              />
              <SettingsRow
                icon={dot(colors.downloads)}
                title={t('storage.downloads')}
                value={localizeDigits(downloads)}
              />
              <SettingsRow
                icon={dot(colors.cache)}
                title={t('storage.cache')}
                value={localizeDigits(cache)}
              />
              <SettingsRow
                icon={dot(colors.free)}
                title={t('storage.free')}
                value={localizeDigits(free)}
              />
            </SettingsSection>

            <SettingsSection title={t('storage.manageHeader')}>
              <SettingsRow
                icon="trash-2"
                title={t('storage.removeDownloadsTitle')}
                subtitle={t('storage.removeDownloadsDescription')}
                destructive
                disabled={isClearing}
                onPress={handleClearAllDownloads}
              />
              <SettingsRow
                icon="refresh-cw"
                title={t('storage.clearCacheTitle')}
                subtitle={t('storage.clearCacheDescription')}
                destructive
                disabled={isClearing}
                onPress={handleClearCache}
              />
            </SettingsSection>
          </>
        )}
      </ScrollView>
    </View>
  );
}
// @ai-end

const local = StyleSheet.create({
  barRow: {
    paddingHorizontal: moderateScale(18),
    paddingVertical: moderateScale(16),
  },
  bar: {
    flexDirection: 'row',
    height: moderateScale(10),
    borderRadius: moderateScale(5),
    overflow: 'hidden',
  },
  segment: {height: '100%'},
  dot: {
    width: moderateScale(12),
    height: moderateScale(12),
    borderRadius: moderateScale(6),
  },
  status: {
    textAlign: 'center',
    marginTop: moderateScale(40),
  },
  errorContainer: {alignItems: 'center', marginTop: moderateScale(40)},
});
