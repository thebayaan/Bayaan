import React from 'react';
import {View, Text, ScrollView, TouchableOpacity, Linking} from 'react-native';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/base';
import Color from 'color';
import {Theme} from '@/utils/themeUtils';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Header from '@/components/Header';

interface Credit {
  title: string;
  description: string;
  link?: string;
}

const CREDITS: {
  section: string;
  items: Credit[];
}[] = [
  {
    section: 'Quran Data',
    items: [
      {
        title: 'Quranic Universal Library',
        description:
          'Advanced Quranic data and word-level information by Tarteel',
        link: 'https://qul.tarteel.ai',
      },
      {
        title: 'Quran Foundation API',
        description: 'Comprehensive Quran API services by Quran.com',
        link: 'https://api-docs.quran.foundation',
      },
    ],
  },
  {
    section: 'Audio Sources',
    items: [
      {
        title: 'MP3Quran',
        description: 'Comprehensive reciter collection',
        link: 'https://mp3quran.net',
      },
    ],
  },
  {
    section: 'Design Resources',
    items: [
      {
        title: 'SVGRepo',
        description: 'Beautiful open source icons and illustrations',
        link: 'https://www.svgrepo.com',
      },
      {
        title: 'Manrope Font',
        description: 'Modern geometric sans-serif font family',
        link: 'https://fonts.google.com/specimen/Manrope',
      },
      {
        title: 'Uthmani Font',
        description: 'Beautiful Quranic font from Arabic Fonts',
        link: 'https://arabicfonts.net',
      },
      {
        title: 'Quran.com Resources',
        description: 'Surah name SVGs and icons',
        link: 'https://api-docs.quran.foundation',
      },
    ],
  },
  {
    section: 'Open Source Libraries',
    items: [
      {
        title: 'React Native',
        description: 'Core framework',
        link: 'https://reactnative.dev',
      },
      {
        title: 'Expo',
        description: 'Development platform',
        link: 'https://expo.dev',
      },
      {
        title: 'React Native Reanimated',
        description: 'Animations library',
        link: 'https://docs.swmansion.com/react-native-reanimated/',
      },
    ],
  },
  {
    section: 'Special Thanks',
    items: [
      {
        title: 'Our Contributors',
        description: 'Everyone who helped make Bayaan better',
      },
      {
        title: 'Beta Testers',
        description: 'For their valuable feedback and suggestions',
      },
      {
        title: 'Muslim Community',
        description: 'For their continuous support and guidance',
      },
    ],
  },
  {
    section: 'Design & Art',
    items: [
      {
        title: 'Dr. Naoki Yamamoto',
        description: 'Custom designed splash screen calligraphy',
        link: 'https://twitter.com/NaokiQYamamoto',
      },
    ],
  },
];

export default function CreditsScreen() {
  const {theme} = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);

  const handleLinkPress = async (url?: string) => {
    if (url) {
      await Linking.openURL(url);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Credits" onBack={() => router.back()} />
      <ScrollView
        style={[styles.content, {paddingTop: insets.top + moderateScale(56)}]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View>
          <Text style={[styles.introText, {color: theme.colors.textSecondary}]}>
            Bayaan wouldn&apos;t be possible without the incredible work of
            these projects, organizations, and individuals. We&apos;re deeply
            grateful for their contributions to the Muslim community and the
            tech world.
          </Text>

          {CREDITS.map((section, sectionIndex) => (
            <View key={section.section} style={styles.section}>
              <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
                {section.section}
              </Text>
              <View style={styles.creditsList}>
                {section.items.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={item.link ? 0.7 : 1}
                    onPress={() => handleLinkPress(item.link)}
                    style={[
                      styles.creditItem,
                      {
                        backgroundColor: Color(theme.colors.card)
                          .alpha(0.5)
                          .toString(),
                      },
                    ]}>
                    <View style={styles.creditContent}>
                      <Text
                        style={[
                          styles.creditTitle,
                          {color: theme.colors.text},
                        ]}>
                        {item.title}
                      </Text>
                      <Text
                        style={[
                          styles.creditDescription,
                          {color: theme.colors.textSecondary},
                        ]}>
                        {item.description}
                      </Text>
                    </View>
                    {item.link && (
                      <Icon
                        name="external-link"
                        type="feather"
                        size={moderateScale(16)}
                        color={theme.colors.textSecondary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <Text
            style={[styles.footerText, {color: theme.colors.textSecondary}]}>
            Made with ❤️ by the Bayaan team
          </Text>
        </View>
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
    introText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.regular,
      lineHeight: moderateScale(24),
      marginBottom: moderateScale(32),
      textAlign: 'center',
    },
    section: {
      marginBottom: moderateScale(24),
    },
    sectionTitle: {
      fontSize: moderateScale(18),
      fontFamily: theme.fonts.semiBold,
      marginBottom: moderateScale(12),
      marginLeft: moderateScale(4),
    },
    creditsList: {
      gap: moderateScale(8),
    },
    creditItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: moderateScale(16),
      borderRadius: moderateScale(12),
    },
    creditContent: {
      flex: 1,
      marginRight: moderateScale(12),
    },
    creditTitle: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      marginBottom: moderateScale(2),
    },
    creditDescription: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
    },
    footerText: {
      textAlign: 'center',
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.medium,
      marginTop: moderateScale(32),
    },
  });
