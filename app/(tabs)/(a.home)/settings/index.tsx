import React from 'react';
import {Text, TouchableOpacity, ScrollView, View, Linking} from 'react-native';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme, ThemeMode, PrimaryColor} from '@/utils/themeUtils';
import {Icon} from '@rneui/base';
import {primaryColors} from '@/styles/colorSchemes';
import {clearPlayerCache} from '@/services/player/utils/storage';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Color from 'color';
import Header from '@/components/Header';
import {openAppStoreForReview, markAsRated} from '@/utils/reviewUtils';
import {QuranIcon} from '@/components/Icons';

// App Store IDs - Replace with your actual IDs

const formatColorName = (colorName: string): string => {
  return colorName
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Helper function to determine if a setting is an external link
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
      // Add more audio settings here as needed
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

      // Add more app settings here as needed
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

export default function SettingsScreen() {
  const router = useRouter();
  const {theme, themeMode, setThemeMode, primaryColor, setPrimaryColor} =
    useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);

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
        // Mark that the user has manually chosen to rate the app
        await markAsRated();
        // Open the app store for review
        await openAppStoreForReview();
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
        <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
          <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
            Theme
          </Text>
          <View style={styles.themeContainer}>
            {themeOptions.map((option, index) => (
              <TouchableOpacity
                activeOpacity={0.7}
                key={option.value}
                style={[
                  styles.themeOption,
                  {
                    backgroundColor:
                      themeMode === option.value
                        ? theme.colors.primary
                        : Color(theme.colors.card).alpha(0.5).toString(),
                  },
                  index === 0 && styles.firstThemeOption,
                  index === themeOptions.length - 1 && styles.lastThemeOption,
                ]}
                onPress={() => setThemeMode(option.value)}>
                <View style={styles.themeContent}>
                  <View style={[styles.iconContainer]}>
                    <Icon
                      name={option.icon}
                      type={option.iconType}
                      size={moderateScale(20)}
                      color={
                        themeMode === option.value ? 'white' : theme.colors.text
                      }
                    />
                  </View>
                  <Text
                    style={[
                      styles.themeText,
                      {
                        color:
                          themeMode === option.value
                            ? 'white'
                            : theme.colors.text,
                        fontFamily:
                          themeMode === option.value
                            ? theme.fonts.semiBold
                            : theme.fonts.regular,
                      },
                    ]}>
                    {option.label}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(200)}
          style={[styles.section, styles.colorSection]}>
          <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
            Accent Color
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.colorScrollContent}>
            {Object.entries(primaryColors).map(([color, value]) => {
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  key={color}
                  style={styles.colorOptionContainer}
                  onPress={() => setPrimaryColor(color as PrimaryColor)}>
                  <View
                    style={[
                      styles.colorOption,
                      {
                        backgroundColor: value,
                        borderColor:
                          primaryColor === color
                            ? theme.colors.text
                            : 'transparent',
                        shadowColor: value,
                        shadowOffset: {width: 0, height: 2},
                        shadowOpacity: 0.25,
                        shadowRadius: 3.84,
                        elevation: 5,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.colorLabel,
                      {
                        color:
                          primaryColor === color
                            ? theme.colors.text
                            : theme.colors.textSecondary,
                        fontFamily:
                          primaryColor === color
                            ? theme.fonts.medium
                            : theme.fonts.regular,
                      },
                    ]}>
                    {formatColorName(color)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>

        {settingsItems.map((section, sectionIndex) => (
          <Animated.View
            key={section.section}
            entering={FadeInDown.delay(300 + sectionIndex * 100)}
            style={styles.section}>
            <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
              {section.section}
            </Text>
            <View style={styles.settingsGroup}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={item.type}
                  style={[
                    styles.settingsItem,
                    styles.settingsItemCard,
                    itemIndex > 0 && styles.settingsItemMarginTop,
                  ]}
                  onPress={() => handleSettingPress(item.type)}
                  activeOpacity={0.7}>
                  <View style={styles.settingsItemContent}>
                    <View style={styles.settingsItemIcon}>
                      {item.iconType === 'custom' && item.icon === 'quran' ? (
                        <QuranIcon
                          size={moderateScale(24)}
                          color={theme.colors.textSecondary}
                        />
                      ) : (
                        <Icon
                          name={item.icon}
                          type={item.iconType}
                          size={moderateScale(20)}
                          color={theme.colors.textSecondary}
                        />
                      )}
                    </View>
                    <View style={styles.settingsTextContainer}>
                      <Text
                        style={[
                          styles.settingsTitle,
                          {color: theme.colors.text},
                        ]}>
                        {item.title}
                      </Text>
                      <Text
                        style={[
                          styles.settingsDescription,
                          {color: theme.colors.textSecondary},
                        ]}>
                        {item.description}
                      </Text>
                    </View>
                    <Icon
                      name={
                        isExternalLink(item.type)
                          ? 'external-link'
                          : 'arrow-right'
                      }
                      type="feather"
                      size={moderateScale(20)}
                      color={theme.colors.textSecondary}
                      containerStyle={{opacity: 0.6}}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        ))}
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
      marginBottom: moderateScale(24),
    },
    sectionTitle: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.medium,
      marginBottom: moderateScale(8),
      marginLeft: moderateScale(4),
    },
    themeContainer: {
      flexDirection: 'row',
      borderRadius: moderateScale(12),
      overflow: 'hidden',
      gap: moderateScale(8),
    },
    themeOption: {
      flex: 1,
      paddingVertical: moderateScale(14),
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: moderateScale(12),
    },
    themeContent: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: moderateScale(4),
    },
    iconContainer: {
      width: moderateScale(42),
      height: moderateScale(42),
      borderRadius: moderateScale(21),
      alignItems: 'center',
      justifyContent: 'center',
      borderColor: 'transparent',
    },
    themeText: {
      fontSize: moderateScale(11),
      fontWeight: '500',
    },
    colorSection: {
      marginBottom: moderateScale(14),
    },
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
    settingsGroup: {
      borderRadius: moderateScale(12),
      overflow: 'hidden',
      gap: moderateScale(1),
    },
    settingsItem: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
    },
    settingsItemCard: {
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(12),
      padding: moderateScale(12),
    },
    settingsItemMarginTop: {
      marginTop: moderateScale(8),
    },
    settingsItemContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    settingsItemIcon: {
      marginRight: moderateScale(15),
      width: moderateScale(24),
      alignItems: 'center',
    },
    settingsTextContainer: {
      flex: 1,
      marginRight: moderateScale(10),
    },
    settingsTitle: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.medium,
      color: theme.colors.text,
    },
    settingsDescription: {
      fontSize: moderateScale(11),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      marginTop: moderateScale(2),
    },
    firstThemeOption: {
      borderTopLeftRadius: moderateScale(12),
      borderBottomLeftRadius: moderateScale(12),
    },
    lastThemeOption: {
      borderTopRightRadius: moderateScale(12),
      borderBottomRightRadius: moderateScale(12),
    },
  });
