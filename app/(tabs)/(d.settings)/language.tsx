// @ai-generated
import React, {useState} from 'react';
import {View, ScrollView, Alert, Linking} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {
  currentLanguage,
  getLanguagePreference,
  languageChangeRequiresRestart,
  languageFollowsSystemSettings,
  setLanguagePreference,
  AVAILABLE_LANGUAGES,
  type LanguagePreference,
} from '@/i18n/language';
import {canRestartToApplyLanguage, restartWithLanguage} from '@/i18n/restart';
import {LANGUAGES} from '@/i18n/languages';
import {
  SettingsIntro,
  SettingsRow,
  SettingsSection,
  useSettingsStyles,
} from '@/components/settings/SettingsList'; // @ai

export default function LanguageScreen() {
  const {theme} = useTheme();
  const {t} = useTranslation();
  const styles = useSettingsStyles(); // @ai
  // iOS owns the language (Settings › Apps › Bayaan › Language), so the
  // screen shows the language this session runs in and has no System option.
  const [selected, setSelected] = useState<LanguagePreference>(() =>
    languageFollowsSystemSettings ? currentLanguage : getLanguagePreference(),
  );

  const options: {value: LanguagePreference; label: string; hint?: string}[] = [
    ...(languageFollowsSystemSettings
      ? []
      : [
          {
            value: 'system' as const,
            label: t('language.system'),
            hint: t('language.systemDescription'),
          },
        ]),
    // Each language is listed by its own name, in its own script.
    ...AVAILABLE_LANGUAGES.map(code => ({
      value: code,
      label: LANGUAGES[code].endonym,
    })),
  ];

  const showReopenNotice = () =>
    Alert.alert(t('languageRestart.title'), t('languageRestart.message'));

  // Android relaunches the app process so the language applies at once.
  const confirmRestart = (value: LanguagePreference) =>
    Alert.alert(
      t('languageRestart.confirmTitle'),
      t('languageRestart.confirmMessage'),
      [
        {text: t('actions.cancel'), style: 'cancel'},
        {
          text: t('languageRestart.restart'),
          onPress: () => {
            setSelected(value);
            if (!restartWithLanguage(value)) {
              showReopenNotice();
            }
          },
        },
      ],
    );

  // iOS relaunches the app in the language chosen in its Settings.
  const confirmOpenSettings = () =>
    Alert.alert(
      t('language.iosSettingsTitle'),
      t('language.iosSettingsMessage'),
      [
        {text: t('actions.cancel'), style: 'cancel'},
        {
          text: t('language.openSettings'),
          onPress: () => {
            // Nothing to fall back to if Settings can't open; the screen
            // note already says where the language lives.
            Linking.openSettings().catch(() => undefined);
          },
        },
      ],
    );

  const handleSelect = (value: LanguagePreference) => {
    if (value === selected) return;
    if (languageFollowsSystemSettings) {
      confirmOpenSettings();
      return;
    }
    if (canRestartToApplyLanguage && languageChangeRequiresRestart(value)) {
      confirmRestart(value);
      return;
    }
    // No process restart available: the choice applies when the app reopens.
    setSelected(value);
    if (setLanguagePreference(value)) {
      showReopenNotice();
    }
  };

  return (
    <View style={{flex: 1, backgroundColor: theme.colors.background}}>
      <ScrollView
        contentContainerStyle={styles.page}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <SettingsIntro
          text={
            languageFollowsSystemSettings
              ? t('language.iosNote')
              : t('language.restartNote')
          }
        />
        <SettingsSection separatorInset="text">
          {options.map(option => (
            <SettingsRow
              key={option.value}
              title={option.label}
              subtitle={option.hint}
              accessory="check"
              accessibilityRole="radio"
              selected={option.value === selected}
              onPress={() => handleSelect(option.value)}
            />
          ))}
        </SettingsSection>
      </ScrollView>
    </View>
  );
}
