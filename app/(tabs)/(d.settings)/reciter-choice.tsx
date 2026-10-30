import React from 'react';
import {ScrollView, View} from 'react-native';
import {NativeSwitch} from '@/components/native/NativeSwitch'; // @ai
import {useTheme} from '@/hooks/useTheme';
import {useSettings} from '@/hooks/useSettings';
// @ai-start
import {useTranslation} from 'react-i18next';
import {
  SettingsIntro,
  SettingsRow,
  SettingsSection,
  useSettingsStyles,
  type SettingsIconName,
} from '@/components/settings/SettingsList';
// @ai-end

// @ai-start
export default function ReciterChoiceScreen() {
  const {theme} = useTheme();
  const {t} = useTranslation('settings');
  const styles = useSettingsStyles();
  const {
    askEveryTime,
    setAskEveryTime,
    defaultReciterSelection,
    setDefaultReciterSelection,
  } = useSettings();

  const options: {
    label: string;
    action: 'browseAll' | 'useDefault';
    description: string;
    icon: SettingsIconName;
  }[] = [
    {
      label: t('reciterChoice.browseAll'),
      action: 'browseAll',
      description: t('reciterChoice.browseAllDescription'),
      icon: 'search',
    },
    {
      label: t('reciterChoice.useDefault'),
      action: 'useDefault',
      description: t('reciterChoice.useDefaultDescription'),
      icon: 'user',
    },
  ];

  return (
    <View style={{flex: 1, backgroundColor: theme.colors.background}}>
      <ScrollView
        contentContainerStyle={styles.page}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <SettingsIntro text={t('reciterChoice.subtitle')} />

        <SettingsSection title={t('reciterChoice.preferenceHeader')}>
          <SettingsRow
            icon="help-circle"
            title={t('reciterChoice.askEveryTime')}
            subtitle={t('reciterChoice.askEveryTimeDescription')}
            accessory={
              <NativeSwitch
                value={askEveryTime}
                onValueChange={() => setAskEveryTime(!askEveryTime)}
              />
            }
          />
        </SettingsSection>

        {!askEveryTime && (
          <SettingsSection title={t('reciterChoice.methodHeader')}>
            {options.map(option => (
              <SettingsRow
                key={option.action}
                icon={option.icon}
                title={option.label}
                subtitle={option.description}
                accessory="check"
                accessibilityRole="radio"
                selected={defaultReciterSelection === option.action}
                onPress={() => setDefaultReciterSelection(option.action)}
              />
            ))}
          </SettingsSection>
        )}
      </ScrollView>
    </View>
  );
}
// @ai-end
