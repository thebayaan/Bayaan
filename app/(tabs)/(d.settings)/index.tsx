import React, {useMemo} from 'react';
import {Text, Pressable, ScrollView, View, Switch} from 'react-native';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {Theme} from '@/utils/themeUtils';
import {Feather, MaterialIcons} from '@expo/vector-icons';
import {clearPlayerCache} from '@/services/player/utils/storage';
import Color from 'color';
import {useBottomInset} from '@/hooks/useBottomInset';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {GlassView} from 'expo-glass-effect';
import {useDevSettingsStore} from '@/store/devSettingsStore';
import {useAnalyticsConsentStore} from '@/store/analyticsConsentStore';
import {ThemePicker} from '@/components/settings/ThemePicker';
import branding from '@/config/branding';
// @ai-start
import {flipX, latinLetterSpacing} from '@/utils/rtl';
import {useTranslation} from 'react-i18next';
import {useResponsive} from '@/hooks/useResponsive';
import {
  SETTINGS_SPLIT_MIN_WIDTH,
  customIconMap,
  getSettingsSections,
  isExternalLink,
  openSettingsItem,
  settingsHref,
} from '@/components/settings/settingsItems';
import {TabletSettingsHome} from '@/components/settings/TabletSettingsList';
import MushafSettingsScreen from './mushaf-settings';
// @ai-end

const renderIcon = (
  item: {icon: string; iconType: string},
  iconColor: string,
) => {
  if (item.iconType === 'custom') {
    const IconComponent = customIconMap[item.icon];
    if (IconComponent) {
      return <IconComponent size={moderateScale(22)} color={iconColor} />;
    }
  }
  if (item.iconType === 'material') {
    return (
      <MaterialIcons
        name={item.icon as any}
        size={moderateScale(20)}
        color={iconColor}
      />
    );
  }
  return (
    <Feather
      name={item.icon as any}
      size={moderateScale(20)}
      color={iconColor}
    />
  );
};

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

  const iconColor = theme.colors.text;
  const chevronColor = theme.colors.textSecondary;

  const trackColor = useMemo(
    () => ({
      false: Color(theme.colors.text).alpha(0.1).toString(),
      true: Color(theme.colors.text).alpha(0.65).toString(),
    }),
    [theme.colors.text],
  );

  const handleSettingPress = async (type: string) => {
    if (type === 'clearCache') {
      await clearPlayerCache();
      return;
    }
    await openSettingsItem(type, routeName =>
      router.push(settingsHref(routeName)),
    );
  };

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

  return (
    <View style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior={USE_GLASS ? 'automatic' : 'never'}
        contentContainerStyle={[styles.scrollContent, contentPadding]}
        showsVerticalScrollIndicator={false}>
        {/* Appearance */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>
            {t('settings:index.appearance')}
          </Text>
          <ThemePicker />
        </View>

        {/* Settings Sections */}
        {settingsSections.map(section => (
          <View key={section.section} style={styles.section}>
            <Text style={styles.sectionHeader}>
              {section.section.toUpperCase()}
            </Text>
            {renderCard(
              section.items.map((item, itemIndex) => (
                <React.Fragment key={item.type}>
                  {itemIndex > 0 && <View style={styles.divider} />}
                  <Pressable
                    style={({pressed}) => [
                      styles.settingsRow,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleSettingPress(item.type)}>
                    <View style={styles.settingsItemIcon}>
                      {renderIcon(item, iconColor)}
                    </View>
                    <View style={styles.settingsTextContainer}>
                      <Text style={styles.settingsTitle}>{item.title}</Text>
                      <Text style={styles.settingsDescription}>
                        {item.description}
                      </Text>
                    </View>
                    <Feather
                      name={
                        isExternalLink(item.type)
                          ? 'external-link'
                          : 'chevron-right'
                      }
                      size={moderateScale(16)}
                      color={chevronColor}
                      style={isExternalLink(item.type) ? undefined : flipX}
                    />
                  </Pressable>
                </React.Fragment>
              )),
            )}
          </View>
        ))}

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>
            {t('settings:index.analytics.section')}
          </Text>
          {renderCard(
            <View style={styles.settingsRow}>
              <View style={styles.settingsItemIcon}>
                <Feather
                  name="bar-chart-2"
                  size={moderateScale(20)}
                  color={iconColor}
                />
              </View>
              <View style={styles.settingsTextContainer}>
                <Text style={styles.settingsTitle}>
                  {t('settings:index.analytics.title')}
                </Text>
                <Text style={styles.settingsDescription}>
                  {t('settings:index.analytics.description', {
                    appName: branding.appName,
                  })}
                </Text>
              </View>
              <Switch
                value={analyticsEnabled}
                onValueChange={handleAnalyticsToggle}
                trackColor={trackColor}
                thumbColor="#FFFFFF"
                ios_backgroundColor={trackColor.false}
                style={styles.switchStyle}
              />
            </View>,
          )}
        </View>

        {/* Developer Section */}
        {__DEV__ && (
          // Dev-only tools stay in English. // @ai
          // i18next-instrument-ignore
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>DEVELOPER</Text>
            {renderCard(
              <View style={styles.settingsRow}>
                <View style={styles.settingsItemIcon}>
                  <Feather
                    name="tool"
                    size={moderateScale(20)}
                    color={iconColor}
                  />
                </View>
                <View style={styles.settingsTextContainer}>
                  <Text style={styles.settingsTitle}>Floating Dev Menu</Text>
                  <Text style={styles.settingsDescription}>
                    Show the floating developer tools button
                  </Text>
                </View>
                <Switch
                  value={showFloatingDevMenu}
                  onValueChange={toggleFloatingDevMenu}
                  trackColor={trackColor}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={trackColor.false}
                  style={styles.switchStyle}
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
const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingHorizontal: moderateScale(16),
    },
    section: {
      marginBottom: moderateScale(14),
    },
    sectionHeader: {
      textAlign: 'left',
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.textSecondary,
      letterSpacing: latinLetterSpacing(1.2),
      textTransform: 'uppercase',
      marginBottom: moderateScale(6),
      marginLeft: moderateScale(2),
    },

    // --- Cards ---
    card: {
      backgroundColor: USE_GLASS
        ? undefined
        : Color(theme.colors.text).alpha(0.04).toString(),
      borderRadius: moderateScale(14),
      borderWidth: USE_GLASS ? 0 : 1,
      borderColor: USE_GLASS
        ? undefined
        : Color(theme.colors.text).alpha(0.06).toString(),
      overflow: 'hidden',
    },
    divider: {
      height: 1,
      backgroundColor: Color(theme.colors.text)
        .alpha(USE_GLASS ? 0.1 : 0.06)
        .toString(),
      marginHorizontal: moderateScale(16),
    },

    // --- Settings Rows ---
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(14),
    },
    pressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    settingsItemIcon: {
      marginRight: moderateScale(12),
      width: moderateScale(24),
      alignItems: 'center',
    },
    settingsTextContainer: {
      flex: 1,
      marginRight: moderateScale(10),
    },
    settingsTitle: {
      textAlign: 'left',
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
    },
    settingsDescription: {
      textAlign: 'left',
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      marginTop: moderateScale(1),
    },

    // --- Switch ---
    switchStyle: {
      transform: [{scaleX: 0.8}, {scaleY: 0.8}],
    },
  });
// @ai-end
