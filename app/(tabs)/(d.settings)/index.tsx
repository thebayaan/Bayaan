import React, {useMemo} from 'react';
import {ScrollView, View} from 'react-native';
import {NativeSwitch} from '@/components/native/NativeSwitch'; // @ai
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {clearPlayerCache} from '@/services/player/utils/storage';
import {useBottomInset} from '@/hooks/useBottomInset';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useDevSettingsStore} from '@/store/devSettingsStore';
import {useAnalyticsConsentStore} from '@/store/analyticsConsentStore';
import {AppearancePicker} from '@/components/settings/AppearancePicker'; // @ai
import {
  SettingsRow,
  SettingsSection,
  useSettingsStyles,
  type SettingsIconName,
} from '@/components/settings/SettingsList'; // @ai
import branding from '@/config/branding';
// @ai-start
import {currentLanguageConfig} from '@/i18n/language';
import {useTranslation} from 'react-i18next';
import {useResponsive} from '@/hooks/useResponsive';
import {
  SETTINGS_SPLIT_MIN_WIDTH,
  getSettingsSections,
  isExternalLink,
  openSettingsItem,
  settingsHref,
} from '@/components/settings/settingsItems';
import {TabletSettingsHome} from '@/components/settings/TabletSettingsList';
import MushafSettingsScreen from './mushaf-settings';
// @ai-end

// @ai-start
/**
 * On iPad, wide windows show the list beside the page, so this first screen
 * of the stack is the default page there; narrower ones show the iPad list.
 */
export default function SettingsScreen() {
  const {isTablet, width} = useResponsive();
  if (!isTablet) {
    return <PhoneSettingsScreen />;
  }
  return width >= SETTINGS_SPLIT_MIN_WIDTH ? (
    <MushafSettingsScreen />
  ) : (
    <TabletSettingsHome />
  );
}
function PhoneSettingsScreen() {
  const router = useRouter();
  const bottomInset = useBottomInset();
  const insets = useSafeAreaInsets();
  const styles = useSettingsStyles();
  const {theme} = useTheme();
  const {showFloatingDevMenu, toggleFloatingDevMenu} = useDevSettingsStore();
  const {t} = useTranslation(['settings', 'common']);
  const settingsSections = useMemo(() => getSettingsSections(t), [t]);
  const {analyticsEnabled, setAnalyticsEnabled} = useAnalyticsConsentStore();

  const handleSettingPress = async (type: string) => {
    if (type === 'clearCache') {
      await clearPlayerCache();
      return;
    }
    await openSettingsItem(type, routeName =>
      router.push(settingsHref(routeName)),
    );
  };

  /** A value shown at the trailing end of a row, before its chevron. */
  const trailingValue = (type: string): string | undefined =>
    type === 'language' ? currentLanguageConfig.endonym : undefined;

  // iOS 26+ NativeTabs: automatic content insets handle top/bottom; manual
  // padding would double-pad. Other platforms: opt out of automatic and pad
  // manually.
  const contentPadding = USE_GLASS
    ? undefined
    : {
        paddingTop: insets.top + moderateScale(10),
        paddingBottom: bottomInset,
      };

  return (
    <View style={{flex: 1, backgroundColor: theme.colors.background}}>
      <ScrollView
        contentInsetAdjustmentBehavior={USE_GLASS ? 'automatic' : 'never'}
        contentContainerStyle={[styles.page, contentPadding]}
        showsVerticalScrollIndicator={false}>
        <SettingsSection
          title={t('settings:index.appearance')}
          separatorInset="none">
          <AppearancePicker />
        </SettingsSection>

        {settingsSections.map(section => (
          <SettingsSection key={section.section} title={section.section}>
            {section.items.map(item => {
              const external = isExternalLink(item.type);
              return (
                <SettingsRow
                  key={item.type}
                  icon={ROW_ICONS[item.type] ?? 'circle'}
                  title={item.title}
                  value={trailingValue(item.type)}
                  accessory={external ? 'external' : 'chevron'}
                  accessibilityRole={external ? 'link' : 'button'}
                  accessibilityHint={item.description}
                  onPress={() => handleSettingPress(item.type)}
                />
              );
            })}
          </SettingsSection>
        ))}

        <SettingsSection
          title={t('settings:index.analytics.section')}
          footer={t('settings:index.analytics.description', {
            appName: branding.appName,
          })}>
          <SettingsRow
            icon="bar-chart-2"
            title={t('settings:index.analytics.title')}
            accessory={
              <NativeSwitch
                value={analyticsEnabled}
                onValueChange={setAnalyticsEnabled}
              />
            }
          />
        </SettingsSection>

        {__DEV__ && (
          // Dev-only tools stay in English. // @ai
          // i18next-instrument-ignore
          <SettingsSection title="Developer">
            <SettingsRow
              icon="tool"
              title="Floating Dev Menu"
              accessory={
                <NativeSwitch
                  value={showFloatingDevMenu}
                  onValueChange={toggleFloatingDevMenu}
                />
              }
            />
          </SettingsSection>
        )}
      </ScrollView>
    </View>
  );
}
// @ai-end

// @ai-start
/** Monochrome outline icons for the phone list (the iPad list keeps its own). */
const ROW_ICONS: Record<string, SettingsIconName> = {
  mushafSettings: 'book-open',
  translations: 'type',
  defaultReciter: 'mic',
  reciterChoice: 'sliders',
  language: 'globe',
  storage: 'hard-drive',
  rateApp: 'star',
  featureRequest: 'zap',
  support: 'message-circle',
  whatsNew: 'gift',
  about: 'info',
  credits: 'award',
  github: 'github',
  terms: 'file-text',
  privacy: 'shield',
};
// @ai-end
