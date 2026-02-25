import React, {useMemo} from 'react';
import {Text, Pressable, ScrollView, View, Linking, Switch} from 'react-native';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme, ThemeMode, PrimaryColor} from '@/utils/themeUtils';
import {Feather, Ionicons, MaterialIcons} from '@expo/vector-icons';
import {primaryColors} from '@/styles/colorSchemes';
import {clearPlayerCache} from '@/services/player/utils/storage';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Color from 'color';
import Header from '@/components/Header';
import {openAppStoreForReview, markAsRated} from '@/utils/reviewUtils';
import {QuranIcon} from '@/components/Icons';
import {useDevSettingsStore} from '@/store/devSettingsStore';

const formatColorName = (colorName: string): string => {
  return colorName
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const isExternalLink = (type: string): boolean => {
  return ['support', 'featureRequest', 'terms', 'privacy', 'rateApp'].includes(
    type,
  );
};

interface ThemeOption {
  label: string;
  value: ThemeMode;
  icon: string;
  iconType: string;
}

const themeOptions: ThemeOption[] = [
  {label: 'System', value: 'system', icon: 'smartphone', iconType: 'feather'},
  {label: 'Light', value: 'light', icon: 'sun', iconType: 'feather'},
  {label: 'Dark', value: 'dark', icon: 'moon', iconType: 'ionicon'},
];

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
    ],
  },
  {
    section: 'Audio & Playback',
    items: [
      {
        title: 'Default Reciter',
        type: 'defaultReciter',
        description: 'Choose your preferred reciter',
        icon: 'user',
        iconType: 'feather',
      },
      {
        title: 'Reciter Choice',
        type: 'reciterChoice',
        description: 'Customize reciter selection',
        icon: 'users',
        iconType: 'feather',
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
        icon: 'hard-drive',
        iconType: 'feather',
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
        iconType: 'feather',
      },
      {
        title: 'Feature Requests',
        type: 'featureRequest',
        description: 'Suggest improvements and new features',
        icon: 'lightbulb-outline',
        iconType: 'material',
      },
      {
        title: 'Help & Support',
        type: 'support',
        description: 'Get assistance with using Bayaan',
        icon: 'help-circle',
        iconType: 'feather',
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
        icon: 'gift',
        iconType: 'feather',
      },
      {
        title: 'About Bayaan',
        type: 'about',
        description: 'Learn more about our mission',
        icon: 'info',
        iconType: 'feather',
      },
      {
        title: 'Credits',
        type: 'credits',
        description: 'View contributors and acknowledgments',
        icon: 'award',
        iconType: 'feather',
      },
      {
        title: 'Terms of Service',
        type: 'terms',
        description: 'Read our terms of service',
        icon: 'file-text',
        iconType: 'feather',
      },
      {
        title: 'Privacy Policy',
        type: 'privacy',
        description: 'View our privacy policy',
        icon: 'shield',
        iconType: 'feather',
      },
    ],
  },
];

const renderIcon = (
  item: {icon: string; iconType: string},
  iconColor: string,
) => {
  if (item.iconType === 'custom' && item.icon === 'quran') {
    return <QuranIcon size={moderateScale(20)} color={iconColor} />;
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
  const {theme, themeMode, setThemeMode, primaryColor, setPrimaryColor} =
    useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {showFloatingDevMenu, toggleFloatingDevMenu} = useDevSettingsStore();

  const iconColor = Color(theme.colors.text).alpha(0.7).toString();
  const chevronColor = Color(theme.colors.text).alpha(0.2).toString();

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
        router.push('/settings/mushaf-settings');
        break;
      case 'defaultReciter':
        router.push('/settings/default-reciter');
        break;
      case 'reciterChoice':
        router.push('/settings/reciter-choice');
        break;
      case 'storage':
        router.push('/settings/storage');
        break;
      case 'clearCache':
        await clearPlayerCache();
        break;
      case 'rateApp':
        await markAsRated();
        await openAppStoreForReview();
        break;
      case 'whatsNew':
        router.push('/settings/whats-new');
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
        router.push('/settings/about');
        break;
      case 'credits':
        router.push('/settings/credits');
        break;
      default:
        break;
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Settings" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {paddingTop: insets.top + moderateScale(56)},
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Theme Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>THEME</Text>
          <View style={styles.segmentedTrack}>
            {themeOptions.map(option => {
              const isActive = themeMode === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.segment, isActive && styles.segmentActive]}
                  onPress={() => setThemeMode(option.value)}>
                  <View style={styles.segmentIconWrap}>
                    {option.iconType === 'ionicon' ? (
                      <Ionicons
                        name={option.icon as any}
                        size={moderateScale(16)}
                        color={
                          isActive
                            ? theme.colors.text
                            : Color(theme.colors.textSecondary)
                                .alpha(0.6)
                                .toString()
                        }
                      />
                    ) : (
                      <Feather
                        name={option.icon as any}
                        size={moderateScale(16)}
                        color={
                          isActive
                            ? theme.colors.text
                            : Color(theme.colors.textSecondary)
                                .alpha(0.6)
                                .toString()
                        }
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: isActive
                          ? theme.colors.text
                          : Color(theme.colors.textSecondary)
                              .alpha(0.6)
                              .toString(),
                        fontFamily: isActive
                          ? 'Manrope-SemiBold'
                          : 'Manrope-Medium',
                      },
                    ]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Accent Color */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ACCENT COLOR</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.colorScrollContent}>
            {Object.entries(primaryColors).map(([color, value]) => {
              const isSelected = primaryColor === color;
              return (
                <Pressable
                  key={color}
                  style={styles.colorOptionContainer}
                  onPress={() => setPrimaryColor(color as PrimaryColor)}>
                  <View
                    style={[
                      styles.colorOption,
                      {
                        backgroundColor: value,
                        borderColor: isSelected
                          ? Color(theme.colors.text).alpha(0.4).toString()
                          : Color(theme.colors.text).alpha(0.08).toString(),
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.colorLabel,
                      {
                        color: isSelected
                          ? Color(theme.colors.text).alpha(0.85).toString()
                          : Color(theme.colors.textSecondary)
                              .alpha(0.45)
                              .toString(),
                        fontFamily: isSelected
                          ? 'Manrope-Medium'
                          : 'Manrope-Regular',
                      },
                    ]}>
                    {formatColorName(color)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Settings Sections */}
        {settingsItems.map(section => (
          <View key={section.section} style={styles.section}>
            <Text style={styles.sectionHeader}>
              {section.section.toUpperCase()}
            </Text>
            <View style={styles.card}>
              {section.items.map((item, itemIndex) => (
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
              ))}
            </View>
          </View>
        ))}

        {/* Developer Section */}
        {__DEV__ && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>DEVELOPER</Text>
            <View style={styles.card}>
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
              </View>
            </View>
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
      paddingBottom: moderateScale(40),
    },
    section: {
      marginBottom: moderateScale(20),
    },
    sectionHeader: {
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: moderateScale(6),
      marginLeft: moderateScale(2),
    },

    // --- Theme Segmented Control ---
    segmentedTrack: {
      flexDirection: 'row',
      borderRadius: moderateScale(10),
      padding: moderateScale(3),
      backgroundColor: Color(theme.colors.text).alpha(0.05).toString(),
    },
    segment: {
      flex: 1,
      paddingVertical: moderateScale(7),
      borderRadius: moderateScale(8),
      alignItems: 'center',
      justifyContent: 'center',
      gap: moderateScale(3),
    },
    segmentActive: {
      backgroundColor: Color(theme.colors.text).alpha(0.12).toString(),
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    },
    segmentIconWrap: {
      height: moderateScale(18),
      justifyContent: 'center',
    },
    segmentText: {
      fontSize: moderateScale(11),
    },

    // --- Accent Color ---
    colorScrollContent: {
      paddingHorizontal: moderateScale(4),
      gap: moderateScale(16),
      flexDirection: 'row',
    },
    colorOptionContainer: {
      alignItems: 'center',
      width: moderateScale(48),
    },
    colorOption: {
      width: moderateScale(32),
      height: moderateScale(32),
      borderRadius: moderateScale(16),
      borderWidth: 2,
      marginBottom: moderateScale(4),
    },
    colorLabel: {
      fontSize: moderateScale(10),
      textAlign: 'center',
    },

    // --- Cards ---
    card: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderRadius: moderateScale(14),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      overflow: 'hidden',
    },
    divider: {
      height: 1,
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
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
      color: Color(theme.colors.text).alpha(0.85).toString(),
    },
    settingsDescription: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      marginTop: moderateScale(1),
    },

    // --- Switch ---
    switchStyle: {
      transform: [{scaleX: 0.8}, {scaleY: 0.8}],
    },
  });
