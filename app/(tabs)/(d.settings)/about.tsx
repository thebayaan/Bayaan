import React, {useMemo} from 'react';
import {View, Text, ScrollView, Image, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {VersionDisplay} from '@/components/VersionDisplay';
// @ai-start
import {useTranslation} from 'react-i18next';
import branding from '@/config/branding';
import {
  SettingsRow,
  SettingsSection,
  useSettingsStyles,
} from '@/components/settings/SettingsList';
// @ai-end

// @ai-start
const FEATURE_KEYS = [
  'offlineDownloads',
  'customPlaylists',
  'browseByJuz',
  'audioControls',
  'highQualityAudio',
  'curatedCollections',
  'personalization',
] as const;
// @ai-end

// @ai-start
const COMING_SOON_KEYS = [
  'translations',
  'wordByWord',
  'bookmarking',
  'learningTools',
  'community',
] as const;
// @ai-end

// @ai-start
export default function AboutScreen() {
  const {theme} = useTheme();
  const styles = useSettingsStyles();
  const local = useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation('settings');
  const appName = branding.appName;

  const prose = (heading: string, body: string) => (
    <SettingsSection title={heading} separatorInset="none">
      <Text style={local.body}>{body}</Text>
    </SettingsSection>
  );

  return (
    <View style={{flex: 1, backgroundColor: theme.colors.background}}>
      <ScrollView
        contentContainerStyle={styles.page}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <View style={local.hero}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={local.logo}
            resizeMode="contain"
          />
          <VersionDisplay style={local.version} />
          <Text style={local.tagline}>{t('about.tagline')}</Text>
        </View>

        {prose(t('about.alhamdulillahHeading'), t('about.alhamdulillahBody'))}
        {prose(t('about.missionHeading'), t('about.missionBody', {appName}))}

        <SettingsSection
          title={t('about.featuresHeader')}
          separatorInset="text">
          {FEATURE_KEYS.map(key => (
            <SettingsRow
              key={key}
              title={t(`about.features.${key}.title`)}
              subtitle={t(`about.features.${key}.description`)}
            />
          ))}
        </SettingsSection>

        <SettingsSection
          title={t('about.comingSoonHeader')}
          footer={t('about.comingSoonIntro')}
          separatorInset="text">
          {COMING_SOON_KEYS.map(key => (
            <SettingsRow
              key={key}
              title={t(`about.comingSoon.${key}.title`)}
              subtitle={t(`about.comingSoon.${key}.description`)}
            />
          ))}
        </SettingsSection>

        {prose(
          t('about.commitmentHeading'),
          t('about.commitmentBody', {appName}),
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    hero: {
      alignItems: 'center',
      gap: moderateScale(6),
      marginTop: moderateScale(8),
      marginBottom: moderateScale(26),
    },
    logo: {
      width: moderateScale(84),
      height: moderateScale(84),
      borderRadius: moderateScale(20),
    },
    version: {
      fontSize: moderateScale(13),
      color: Color(theme.colors.text).alpha(0.5).toString(),
    },
    tagline: {
      textAlign: 'center',
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
      marginHorizontal: moderateScale(18),
    },
    body: {
      textAlign: 'left',
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-Regular',
      lineHeight: moderateScale(22),
      color: Color(theme.colors.text).alpha(0.8).toString(),
      padding: moderateScale(18),
    },
  });
// @ai-end
