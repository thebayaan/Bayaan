import React, {useMemo} from 'react';
import {View, Text, ScrollView, Pressable, Linking} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {Theme} from '@/utils/themeUtils';

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
  const styles = useMemo(() => createStyles(theme), [theme]);

  const linkIconColor = Color(theme.colors.text).alpha(0.35).toString();
  const pressedBg = Color(theme.colors.text).alpha(0.06).toString();

  const handleLinkPress = async (url?: string) => {
    if (url) {
      await Linking.openURL(url);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.introText}>
            Bayaan wouldn&apos;t be possible without the incredible work of
            these projects, organizations, and individuals. We&apos;re deeply
            grateful for their contributions to the Muslim community and the
            tech world.
          </Text>

          {CREDITS.map(section => (
            <View key={section.section} style={styles.section}>
              <Text style={styles.sectionHeader}>
                {section.section.toUpperCase()}
              </Text>
              <View style={styles.card}>
                {section.items.map((item, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <View style={styles.divider} />}
                    <Pressable
                      style={({pressed}) => [
                        styles.creditRow,
                        pressed && item.link
                          ? {backgroundColor: pressedBg}
                          : null,
                      ]}
                      onPress={() => handleLinkPress(item.link)}
                      disabled={!item.link}>
                      <View style={styles.creditContent}>
                        <Text style={styles.creditTitle}>{item.title}</Text>
                        <Text style={styles.creditDescription}>
                          {item.description}
                        </Text>
                      </View>
                      {item.link && (
                        <Feather
                          name="external-link"
                          size={moderateScale(14)}
                          color={linkIconColor}
                        />
                      )}
                    </Pressable>
                  </React.Fragment>
                ))}
              </View>
            </View>
          ))}

          <Text style={styles.footerText}>Made with ❤️ by the Bayaan team</Text>
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
      paddingHorizontal: moderateScale(20),
      paddingVertical: moderateScale(20),
      paddingBottom: moderateScale(160),
    },
    introText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      lineHeight: moderateScale(20),
      marginBottom: moderateScale(28),
      textAlign: 'center',
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
    creditRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(16),
    },
    creditContent: {
      flex: 1,
      marginRight: moderateScale(12),
    },
    creditTitle: {
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.85).toString(),
      marginBottom: moderateScale(2),
    },
    creditDescription: {
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
    },
    footerText: {
      textAlign: 'center',
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      marginTop: moderateScale(24),
    },
  });
