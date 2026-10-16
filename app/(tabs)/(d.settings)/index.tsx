import {getAppDisplayName} from '@/i18n/format'; // @ai
import React, {useMemo} from 'react';
import {Text, Pressable, ScrollView, View, Linking, Switch} from 'react-native';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {Feather, MaterialIcons} from '@expo/vector-icons';
import {clearPlayerCache} from '@/services/player/utils/storage';
import Color from 'color';
import {useBottomInset} from '@/hooks/useBottomInset';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {GlassView} from 'expo-glass-effect';
import {openAppStoreForReview, markAsRated} from '@/utils/reviewUtils';
import {
  QuranIcon,
  DualPagesIcon,
  PersonAudioIcon,
  SelectionListIcon,
  DatabaseIcon,
  ThreeStarsReviewIcon,
  LightbulbIcon,
  ChatBubbleIcon,
  GiftBoxIcon,
  InfoRoundedIcon,
  MedalIcon,
  DocCheckIcon,
  ShieldLockIcon,
} from '@/components/Icons';
import {useDevSettingsStore} from '@/store/devSettingsStore';
import {useAnalyticsConsentStore} from '@/store/analyticsConsentStore';
import {ThemePicker} from '@/components/settings/ThemePicker';
import branding from '@/config/branding';
// @ai-start
import {flipX, latinLetterSpacing} from '@/utils/rtl';
import {useTranslation} from 'react-i18next';
import {currentLanguage} from '@/i18n/language';
import {getIntlLocale} from '@/i18n/languages';
import type {TFunction} from 'i18next';
// @ai-end

const isExternalLink = (type: string): boolean => {
  return [
    'support',
    'featureRequest',
    'terms',
    'privacy',
    'rateApp',
    'github',
  ].includes(type);
};

// @ai-start
const getSettingsSections = (t: TFunction<['settings', 'common']>) => {
  const appName = getAppDisplayName(branding.appName); // @ai
  return [
    {
      section: t('settings:index.sections.quran'),
      items: [
        {
          title: t('settings:index.items.mushafSettings.title'),
          type: 'mushafSettings',
          description: t('settings:index.items.mushafSettings.description'),
          icon: 'quran',
          iconType: 'custom',
        },
        {
          title: t('settings:index.items.translations.title'),
          type: 'translations',
          description: t('settings:index.items.translations.description'),
          icon: 'dualPages',
          iconType: 'custom',
        },
      ],
    },
    {
      section: t('settings:index.sections.audio'),
      items: [
        {
          title: t('settings:index.items.defaultReciter.title'),
          type: 'defaultReciter',
          description: t('settings:index.items.defaultReciter.description'),
          icon: 'personAudio',
          iconType: 'custom',
        },
        {
          title: t('settings:index.items.reciterChoice.title'),
          type: 'reciterChoice',
          description: t('settings:index.items.reciterChoice.description'),
          icon: 'selectionList',
          iconType: 'custom',
        },
      ],
    },
    {
      section: t('settings:index.sections.appData'),
      items: [
        {
          title: t('common:language.title'),
          type: 'language',
          description: t('common:language.description'),
          icon: 'globe',
          iconType: 'feather',
        },
        {
          title: t('settings:index.items.storage.title'),
          type: 'storage',
          description: t('settings:index.items.storage.description'),
          icon: 'database',
          iconType: 'custom',
        },
      ],
    },
    {
      section: t('settings:index.sections.feedback'),
      items: [
        {
          title: t('settings:index.items.rateApp.title'),
          type: 'rateApp',
          description: t('settings:index.items.rateApp.description'),
          icon: 'star',
          iconType: 'custom',
        },
        {
          title: t('settings:index.items.featureRequest.title'),
          type: 'featureRequest',
          description: t('settings:index.items.featureRequest.description'),
          icon: 'lightbulb',
          iconType: 'custom',
        },
        {
          title: t('settings:index.items.support.title'),
          type: 'support',
          description: t('settings:index.items.support.description', {appName}),
          icon: 'chatBubble',
          iconType: 'custom',
        },
      ],
    },
    {
      section: t('settings:index.sections.about', {appName}),
      items: [
        {
          title: t('settings:index.items.whatsNew.title'),
          type: 'whatsNew',
          description: t('settings:index.items.whatsNew.description'),
          icon: 'giftBox',
          iconType: 'custom',
        },
        {
          title: t('settings:index.items.about.title', {appName}),
          type: 'about',
          description: t('settings:index.items.about.description'),
          icon: 'infoRounded',
          iconType: 'custom',
        },
        {
          title: t('settings:index.items.credits.title'),
          type: 'credits',
          description: t('settings:index.items.credits.description'),
          icon: 'medal',
          iconType: 'custom',
        },
        {
          title: t('settings:index.items.github.title'),
          type: 'github',
          description: t('settings:index.items.github.description', {appName}),
          icon: 'github',
          iconType: 'feather',
        },
        {
          title: t('settings:index.items.terms.title'),
          type: 'terms',
          description: t('settings:index.items.terms.description'),
          icon: 'docCheck',
          iconType: 'custom',
        },
        {
          title: t('settings:index.items.privacy.title'),
          type: 'privacy',
          description: t('settings:index.items.privacy.description'),
          icon: 'shieldLock',
          iconType: 'custom',
        },
      ],
    },
  ];
};
// @ai-end

const customIconMap: Record<string, React.FC<{size: number; color: string}>> = {
  quran: QuranIcon,
  dualPages: DualPagesIcon,
  personAudio: PersonAudioIcon,
  selectionList: SelectionListIcon,
  database: DatabaseIcon,
  star: ThreeStarsReviewIcon,
  lightbulb: LightbulbIcon,
  chatBubble: ChatBubbleIcon,
  giftBox: GiftBoxIcon,
  infoRounded: InfoRoundedIcon,
  medal: MedalIcon,
  docCheck: DocCheckIcon,
  shieldLock: ShieldLockIcon,
};

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
export default function SettingsScreen() {
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
    switch (type) {
      case 'mushafSettings':
        router.push('/(d.settings)/mushaf-settings');
        break;
      case 'translations':
        router.push('/(d.settings)/translations');
        break;
      case 'defaultReciter':
        router.push('/(d.settings)/default-reciter');
        break;
      case 'reciterChoice':
        router.push('/(d.settings)/reciter-choice');
        break;
      case 'language':
        router.push('/(d.settings)/language');
        break;
      case 'storage':
        router.push('/(d.settings)/storage');
        break;
      case 'clearCache':
        await clearPlayerCache();
        break;
      case 'rateApp':
        await markAsRated();
        await openAppStoreForReview();
        break;
      case 'whatsNew':
        router.push('/(d.settings)/whats-new');
        break;
      case 'support':
        await Linking.openURL(branding.supportUrl);
        break;
      case 'featureRequest':
        await Linking.openURL(branding.supportUrl);
        break;
      case 'terms':
        await Linking.openURL(branding.termsUrl);
        break;
      case 'privacy':
        await Linking.openURL(branding.privacyUrl);
        break;
      case 'about':
        router.push('/(d.settings)/about');
        break;
      case 'credits':
        router.push('/(d.settings)/credits');
        break;
      case 'github':
        await Linking.openURL('https://github.com/thebayaan/Bayaan');
        break;
      default:
        break;
    }
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
              {section.section.toLocaleUpperCase(
                getIntlLocale(currentLanguage),
              )}
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
                    appName: getAppDisplayName(branding.appName),
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
