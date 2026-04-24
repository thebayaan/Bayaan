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
import {ThemePicker} from '@/components/settings/ThemePicker';

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

const settingsItems = [
  {
    section: 'Quran',
    items: [
      {
        title: 'Mushaf Settings',
        type: 'mushafSettings',
        description: 'Customize Quran display options',
        icon: 'quran',
        iconType: 'custom',
      },
      {
        title: 'Translations & Tafaseer',
        type: 'translations',
        description: 'Manage Quran translations and commentary',
        icon: 'dualPages',
        iconType: 'custom',
      },
    ],
  },
  {
    section: 'Audio & Playback',
    items: [
      {
        title: 'Default Reciter',
        type: 'defaultReciter',
        description: 'Choose your preferred reciter',
        icon: 'personAudio',
        iconType: 'custom',
      },
      {
        title: 'Reciter Choice',
        type: 'reciterChoice',
        description: 'Customize reciter selection',
        icon: 'selectionList',
        iconType: 'custom',
      },
    ],
  },
  {
    section: 'App & Data',
    items: [
      {
        title: 'Storage',
        type: 'storage',
        description: 'View and manage storage usage',
        icon: 'database',
        iconType: 'custom',
      },
    ],
  },
  {
    section: 'Feedback',
    items: [
      {
        title: 'Write a Review',
        type: 'rateApp',
        description: 'Share your experience with others',
        icon: 'star',
        iconType: 'custom',
      },
      {
        title: 'Feature Requests',
        type: 'featureRequest',
        description: 'Suggest improvements and new features',
        icon: 'lightbulb',
        iconType: 'custom',
      },
      {
        title: 'Help & Support',
        type: 'support',
        description: 'Get assistance with using Bayaan',
        icon: 'chatBubble',
        iconType: 'custom',
      },
    ],
  },
  {
    section: 'About Bayaan',
    items: [
      {
        title: "What's New",
        type: 'whatsNew',
        description: "See what's new in this version",
        icon: 'giftBox',
        iconType: 'custom',
      },
      {
        title: 'About Bayaan',
        type: 'about',
        description: 'Learn more about our mission',
        icon: 'infoRounded',
        iconType: 'custom',
      },
      {
        title: 'Credits',
        type: 'credits',
        description: 'View contributors and acknowledgments',
        icon: 'medal',
        iconType: 'custom',
      },
      {
        title: 'Contribute on GitHub',
        type: 'github',
        description:
          'Bayaan is now open source. Star, report issues, or submit a PR',
        icon: 'github',
        iconType: 'feather',
      },
      {
        title: 'Terms of Service',
        type: 'terms',
        description: 'Read our terms of service',
        icon: 'docCheck',
        iconType: 'custom',
      },
      {
        title: 'Privacy Policy',
        type: 'privacy',
        description: 'View our privacy policy',
        icon: 'shieldLock',
        iconType: 'custom',
      },
    ],
  },
];

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

export default function SettingsScreen() {
  const router = useRouter();
  const {theme} = useTheme();
  const bottomInset = useBottomInset();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const glassColorScheme = useGlassColorScheme();
  const {showFloatingDevMenu, toggleFloatingDevMenu} = useDevSettingsStore();

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
        await Linking.openURL('https://thebayaan.com/support');
        break;
      case 'featureRequest':
        await Linking.openURL('https://thebayaan.com/support');
        break;
      case 'terms':
        await Linking.openURL('https://thebayaan.com/terms');
        break;
      case 'privacy':
        await Linking.openURL('https://thebayaan.com/privacy');
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
          <Text style={styles.sectionHeader}>APPEARANCE</Text>
          <ThemePicker />
        </View>

        {/* Settings Sections */}
        {settingsItems.map(section => (
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
                    />
                  </Pressable>
                </React.Fragment>
              )),
            )}
          </View>
        ))}

        {/* Developer Section */}
        {__DEV__ && (
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
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.textSecondary,
      letterSpacing: 1.2,
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
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
    },
    settingsDescription: {
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
