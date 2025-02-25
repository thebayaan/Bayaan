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
import {BlurView} from '@react-native-community/blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Color from 'color';

const formatColorName = (colorName: string): string => {
  return colorName
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const themeOptions: {label: string; value: ThemeMode}[] = [
  {label: 'System', value: 'system'},
  {label: 'Light', value: 'light'},
  {label: 'Dark', value: 'dark'},
];

const settingsItems = [
  {
    section: 'Audio & Playback',
    items: [
      {
        title: 'Default Reciter',
        type: 'defaultReciter',
        description: 'Choose your preferred reciter',
      },
      {
        title: 'Reciter Choice',
        type: 'reciterChoice',
        description: 'Customize reciter selection',
      },
    ],
  },
  {
    section: 'Storage & Data',
    items: [
      {
        title: 'Clear Cache',
        type: 'clearCache',
        description: 'Clear app data and cache',
      },
    ],
  },
  /* Temporarily removed for link updates
  {
    section: 'Support & Legal',
    items: [
      {
        title: 'Help & Support',
        type: 'support',
        description: 'Get help and contact support',
      },
      {
        title: 'Feature Requests',
        type: 'featureRequest',
        description: 'Submit feature requests and feedback',
      },
      {
        title: 'Terms of Service',
        type: 'terms',
        description: 'Read our terms of service',
      },
      {
        title: 'Privacy Policy',
        type: 'privacy',
        description: 'View our privacy policy',
      },
    ],
  },
  */
  {
    section: 'About',
    items: [
      {
        title: 'About Bayaan',
        type: 'about',
        description: 'Learn more about Bayaan',
      },
      {
        title: 'Credits',
        type: 'credits',
        description: 'View contributors and acknowledgments',
      },
    ],
  },
];

// Add your App Store ID here once available

export default function SettingsScreen() {
  const router = useRouter();
  const {theme, themeMode, setThemeMode, primaryColor, setPrimaryColor} =
    useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);

  const handleSettingPress = async (type: string) => {
    switch (type) {
      case 'defaultReciter':
        router.push('/settings/default-reciter');
        break;
      case 'reciterChoice':
        router.push('/settings/reciter-choice');
        break;
      case 'clearCache':
        await clearPlayerCache();
        break;
      case 'support':
        await Linking.openURL('https://thebayaan.com/support');
        break;
      case 'featureRequest':
        await Linking.openURL('https://thebayaan.com/feedback');
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
      <Animated.View style={[styles.header, {paddingTop: insets.top}]}>
        <BlurView
          blurAmount={10}
          blurType={theme.isDarkMode ? 'dark' : 'light'}
          style={[styles.blurContainer]}>
          <View
            style={[
              styles.overlay,
              {
                backgroundColor: theme.colors.background,
              },
            ]}
          />
        </BlurView>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.7}
            onPress={() => router.back()}>
            <Icon
              name="arrow-left"
              type="feather"
              size={moderateScale(24)}
              color={theme.colors.text}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: theme.colors.text}]}>
            Settings
          </Text>
        </View>
      </Animated.View>

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
                <Text
                  style={[
                    styles.themeText,
                    {
                      color:
                        themeMode === option.value
                          ? theme.colors.background
                          : theme.colors.text,
                      fontFamily:
                        themeMode === option.value
                          ? theme.fonts.semiBold
                          : theme.fonts.regular,
                    },
                  ]}>
                  {option.label}
                </Text>
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
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.type}
                  style={[
                    styles.settingItem,
                    {
                      backgroundColor: theme.colors.card,
                      borderTopLeftRadius: index === 0 ? moderateScale(12) : 0,
                      borderTopRightRadius: index === 0 ? moderateScale(12) : 0,
                      borderBottomLeftRadius:
                        index === section.items.length - 1
                          ? moderateScale(12)
                          : 0,
                      borderBottomRightRadius:
                        index === section.items.length - 1
                          ? moderateScale(12)
                          : 0,
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleSettingPress(item.type)}>
                  <View style={styles.settingContent}>
                    <View style={styles.settingTexts}>
                      <Text
                        style={[
                          styles.settingTitle,
                          {color: theme.colors.text},
                        ]}>
                        {item.title}
                      </Text>
                      <Text
                        style={[
                          styles.settingDescription,
                          {color: theme.colors.textSecondary},
                        ]}>
                        {item.description}
                      </Text>
                    </View>
                    <Icon
                      name="arrow-right"
                      type="feather"
                      size={moderateScale(20)}
                      color={theme.colors.textSecondary}
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
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
    },
    blurContainer: {
      overflow: 'hidden',
      borderWidth: 0.1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.85,
    },
    headerContent: {
      height: moderateScale(56),
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(16),
    },
    backButton: {
      marginRight: moderateScale(16),
    },
    headerTitle: {
      fontSize: moderateScale(18),
      fontFamily: theme.fonts.semiBold,
      flex: 1,
      textAlign: 'center',
      marginRight: moderateScale(40), // To center the title accounting for back button
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
      paddingVertical: moderateScale(12),
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: moderateScale(12),
    },
    themeText: {
      fontSize: moderateScale(14),
    },
    colorSection: {
      marginBottom: moderateScale(32),
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
    settingItem: {
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(16),
    },
    settingContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    settingTexts: {
      flex: 1,
      marginRight: moderateScale(16),
    },
    settingTitle: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.medium,
      marginBottom: moderateScale(2),
    },
    settingDescription: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
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
