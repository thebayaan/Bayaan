import React, {useMemo} from 'react';
import {Text, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {NativeSwitch} from '@/components/native/NativeSwitch'; // @ai
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {Theme} from '@/utils/themeUtils';
import {Feather} from '@expo/vector-icons';
import {clearPlayerCache} from '@/services/player/utils/storage';
import Color from 'color';
import {useBottomInset} from '@/hooks/useBottomInset';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {GlassView} from 'expo-glass-effect';
import {useDevSettingsStore} from '@/store/devSettingsStore';
import {useAnalyticsConsentStore} from '@/store/analyticsConsentStore';
import {AppearancePicker} from '@/components/settings/AppearancePicker'; // @ai
import branding from '@/config/branding';
// @ai-start
import {flipX} from '@/utils/rtl';
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
  const {theme} = useTheme();
  const bottomInset = useBottomInset();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const glassColorScheme = useGlassColorScheme();
  const {showFloatingDevMenu, toggleFloatingDevMenu} = useDevSettingsStore();
  const {t} = useTranslation(['settings', 'common']);
  const settingsSections = useMemo(() => getSettingsSections(t), [t]);
  const {analyticsEnabled, setAnalyticsEnabled} = useAnalyticsConsentStore();

  const handleAnalyticsToggle = (value: boolean): void => {
    // The analytics service subscribes to this store and pushes the choice
    // straight to the PostHog SDK, so flipping the flag is all we do here.
    setAnalyticsEnabled(value);
  };

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

  const renderCard = (children: React.ReactNode) =>
    USE_GLASS ? (
      <GlassView
        style={styles.card}
        glassEffectStyle="regular"
        colorScheme={glassColorScheme}>
        {children}
      </GlassView>
    ) : (
      <View style={styles.card}>{children}</View>
    );

  const renderIcon = (name: FeatherName) => (
    <View style={styles.icon}>
      <Feather name={name} size={ICON_SIZE} color={theme.colors.text} />
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior={USE_GLASS ? 'automatic' : 'never'}
        contentContainerStyle={[styles.scrollContent, contentPadding]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>
            {t('settings:index.appearance')}
          </Text>
          {renderCard(<AppearancePicker />)}
        </View>

        {settingsSections.map(section => (
          <View key={section.section} style={styles.section}>
            <Text style={styles.sectionHeader}>{section.section}</Text>
            {renderCard(
              section.items.map((item, itemIndex) => {
                const value = trailingValue(item.type);
                const external = isExternalLink(item.type);
                return (
                  <React.Fragment key={item.type}>
                    {itemIndex > 0 && <View style={styles.separator} />}
                    <Pressable
                      style={({pressed}) => [
                        styles.row,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => handleSettingPress(item.type)}
                      accessibilityRole={external ? 'link' : 'button'}
                      accessibilityHint={item.description}>
                      {renderIcon(ROW_ICONS[item.type] ?? 'circle')}
                      <Text style={styles.title} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {value ? (
                        <Text style={styles.value} numberOfLines={1}>
                          {value}
                        </Text>
                      ) : null}
                      <Feather
                        name={external ? 'arrow-up-right' : 'chevron-right'}
                        size={CHEVRON_SIZE}
                        color={styles.chevron.color}
                        style={external ? undefined : flipX}
                      />
                    </Pressable>
                  </React.Fragment>
                );
              }),
            )}
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>
            {t('settings:index.analytics.section')}
          </Text>
          {renderCard(
            <View
              style={styles.row}
              accessible
              accessibilityHint={t('settings:index.analytics.description', {
                appName: branding.appName,
              })}>
              {renderIcon('bar-chart-2')}
              <Text style={styles.title} numberOfLines={1}>
                {t('settings:index.analytics.title')}
              </Text>
              <NativeSwitch
                value={analyticsEnabled}
                onValueChange={handleAnalyticsToggle}
              />
            </View>,
          )}
          <Text style={styles.footnote}>
            {t('settings:index.analytics.description', {
              appName: branding.appName,
            })}
          </Text>
        </View>

        {__DEV__ && (
          // Dev-only tools stay in English. // @ai
          // i18next-instrument-ignore
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Developer</Text>
            {renderCard(
              <View style={styles.row}>
                {renderIcon('tool')}
                <Text style={styles.title} numberOfLines={1}>
                  Floating Dev Menu
                </Text>
                <NativeSwitch
                  value={showFloatingDevMenu}
                  onValueChange={toggleFloatingDevMenu}
                />
              </View>,
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
// @ai-end

// @ai-start
type FeatherName = React.ComponentProps<typeof Feather>['name'];

/** Monochrome outline icons for the phone list (the iPad list keeps its own). */
const ROW_ICONS: Record<string, FeatherName> = {
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

const ICON_SIZE = moderateScale(21);
const CHEVRON_SIZE = moderateScale(18);
/** Row padding; section headers line up with the icons at this inset. */
const ROW_INSET = moderateScale(18);
const ICON_GAP = moderateScale(16);

const createStyles = (theme: Theme) => {
  const isDark = theme.isDarkMode;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingHorizontal: moderateScale(16),
    },
    section: {
      marginBottom: moderateScale(26),
    },
    sectionHeader: {
      textAlign: 'left',
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.regular,
      color: Color(theme.colors.text).alpha(0.55).toString(),
      marginBottom: moderateScale(10),
      marginStart: ROW_INSET,
    },
    card: {
      backgroundColor: USE_GLASS
        ? undefined
        : isDark
          ? Color('#ffffff').alpha(0.07).toString()
          : '#ffffff',
      borderRadius: moderateScale(24),
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: moderateScale(56),
      paddingHorizontal: ROW_INSET,
      gap: ICON_GAP,
    },
    pressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    icon: {
      width: ICON_SIZE,
      alignItems: 'center',
    },
    title: {
      flex: 1,
      textAlign: 'left',
      fontSize: moderateScale(16.5),
      fontFamily: theme.fonts.regular,
      color: theme.colors.text,
    },
    value: {
      maxWidth: '45%',
      fontSize: moderateScale(15.5),
      fontFamily: theme.fonts.regular,
      color: Color(theme.colors.text).alpha(0.5).toString(),
    },
    chevron: {
      color: Color(theme.colors.text).alpha(0.35).toString(),
    },
    // Starts under the title, not the icon, and stops at the trailing inset.
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Color(theme.colors.text).alpha(0.14).toString(),
      marginStart: ROW_INSET + ICON_SIZE + ICON_GAP,
      marginEnd: ROW_INSET,
    },
    footnote: {
      textAlign: 'left',
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.regular,
      color: Color(theme.colors.text).alpha(0.5).toString(),
      marginTop: moderateScale(8),
      marginHorizontal: ROW_INSET,
    },
  });
};
// @ai-end
