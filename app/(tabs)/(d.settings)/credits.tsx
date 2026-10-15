import {getAppDisplayName} from '@/i18n/format'; // @ai
import React, {useMemo} from 'react';
import {View, Text, ScrollView, Pressable, Linking} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {Theme} from '@/utils/themeUtils';
import branding from '@/config/branding';
// @ai-start
import {latinLetterSpacing} from '@/utils/rtl';
import {useTranslation} from 'react-i18next';
import type {TFunction} from 'i18next';
// @ai-end

interface Credit {
  title: string;
  description: string;
  link?: string;
}

/**
 * Credits data factory. Brand strings (e.g. `branding.appName`) resolve
 * at call time, not module load — this lets a fork override `branding`
 * without having to fork this file. Originally a top-level const, but
 * top-level const arrays evaluate before any `branding` resolution,
 * baking the upstream brand name into the bundle.
 */
// @ai-start
function getCredits(
  t: TFunction<'settings'>,
): {section: string; items: Credit[]}[] {
  const appName = getAppDisplayName(branding.appName); // @ai
  return [
    {
      section: t('credits.sections.quranData'),
      items: [
        {
          title: 'Quranic Universal Library',
          description: t('credits.items.qul'),
          link: 'https://qul.tarteel.ai',
        },
        {
          title: 'Quran Foundation API',
          description: t('credits.items.quranFoundation'),
          link: 'https://api-docs.quran.foundation',
        },
      ],
    },
    {
      section: t('credits.sections.audioSources'),
      items: [
        {
          title: 'MP3Quran',
          description: t('credits.items.mp3quran'),
          link: 'https://mp3quran.net',
        },
      ],
    },
    {
      section: t('credits.sections.designResources'),
      items: [
        {
          title: 'SVGRepo',
          description: t('credits.items.svgrepo'),
          link: 'https://www.svgrepo.com',
        },
        {
          title: t('credits.items.manropeTitle'),
          description: t('credits.items.manrope'),
          link: 'https://fonts.google.com/specimen/Manrope',
        },
        {
          title: t('credits.items.uthmaniTitle'),
          description: t('credits.items.uthmani'),
          link: 'https://arabicfonts.net',
        },
        {
          title: t('credits.items.quranComTitle'),
          description: t('credits.items.quranCom'),
          link: 'https://api-docs.quran.foundation',
        },
      ],
    },
    {
      section: t('credits.sections.openSource'),
      items: [
        {
          title: 'React Native',
          description: t('credits.items.reactNative'),
          link: 'https://reactnative.dev',
        },
        {
          title: 'Expo',
          description: t('credits.items.expo'),
          link: 'https://expo.dev',
        },
        {
          title: 'React Native Reanimated',
          description: t('credits.items.reanimated'),
          link: 'https://docs.swmansion.com/react-native-reanimated/',
        },
      ],
    },
    {
      section: t('credits.sections.specialThanks'),
      items: [
        {
          title: t('credits.items.contributorsTitle'),
          description: t('credits.items.contributors', {appName}),
        },
        {
          title: t('credits.items.betaTestersTitle'),
          description: t('credits.items.betaTesters'),
        },
        {
          title: t('credits.items.communityTitle'),
          description: t('credits.items.community'),
        },
      ],
    },
    {
      section: t('credits.sections.designArt'),
      items: [
        {
          title: t('credits.items.yamamotoTitle'),
          description: t('credits.items.yamamoto'),
          link: 'https://twitter.com/NaokiQYamamoto',
        },
      ],
    },
  ];
}
// @ai-end

// @ai-start
export default function CreditsScreen() {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation('settings');
  const credits = useMemo(() => getCredits(t), [t]);

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
            {t('credits.intro', {appName: getAppDisplayName(branding.appName)})}
          </Text>

          {credits.map(section => (
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

          <Text style={styles.footerText}>
            {t('credits.footer', {
              appName: getAppDisplayName(branding.appName),
            })}
          </Text>
        </View>
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
      letterSpacing: latinLetterSpacing(1.2),
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
// @ai-end
