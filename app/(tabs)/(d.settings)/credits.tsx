import React, {useMemo} from 'react';
import {View, ScrollView, Linking} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import branding from '@/config/branding';
// @ai-start
import {useTranslation} from 'react-i18next';
import type {TFunction} from 'i18next';
import {
  SettingsIntro,
  SettingsRow,
  SettingsSection,
  useSettingsStyles,
} from '@/components/settings/SettingsList'; // @ai
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
  const appName = branding.appName;
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
        {
          title: t('credits.items.alafasyTitle'),
          description: t('credits.items.alafasy'),
          link: 'http://www.alafasy.tv',
        },
        {
          title: t('credits.items.duraihimTitle'),
          description: t('credits.items.duraihim'),
          link: 'https://islamhouse.com',
        },
        {
          title: t('credits.items.removalTitle'),
          description: t('credits.items.removal', {
            supportUrl: branding.supportUrl,
          }),
          link: branding.supportUrl,
        },
      ],
    },
    {
      section: t('credits.sections.adhkarSources'),
      items: [
        {
          title: 'hisnmuslim.com',
          description: t('credits.items.hisnmuslim'),
          link: 'https://www.hisnmuslim.com',
        },
        {
          title: 'Tanzil',
          description: t('credits.items.tanzil'),
          link: 'https://tanzil.net/trans/',
        },
        {
          title: 'Wikipedia contributors',
          description: t('credits.items.wikipediaNames'),
          link: 'https://creativecommons.org/licenses/by-sa/4.0/',
        },
        {
          title: 'fitrahive/dua-dhikr',
          description: t('credits.items.fitrahive'),
          link: 'https://github.com/fitrahive/dua-dhikr',
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
  ];
}
// @ai-end

// @ai-start
export default function CreditsScreen() {
  const {theme} = useTheme();
  const styles = useSettingsStyles(); // @ai
  const {t} = useTranslation('settings');
  const credits = useMemo(() => getCredits(t), [t]);

  return (
    <View style={{flex: 1, backgroundColor: theme.colors.background}}>
      <ScrollView
        contentContainerStyle={styles.page}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <SettingsIntro text={t('credits.intro', {appName: branding.appName})} />
        {credits.map(group => (
          <SettingsSection
            key={group.section}
            title={group.section}
            separatorInset="text">
            {group.items.map(item => {
              const link = item.link;
              return (
                <SettingsRow
                  key={item.title}
                  title={item.title}
                  subtitle={item.description}
                  accessory={link ? 'external' : 'none'}
                  accessibilityRole={link ? 'link' : undefined}
                  onPress={link ? () => Linking.openURL(link) : undefined}
                />
              );
            })}
          </SettingsSection>
        ))}
        <SettingsIntro
          text={t('credits.footer', {appName: branding.appName})}
        />
      </ScrollView>
    </View>
  );
}
