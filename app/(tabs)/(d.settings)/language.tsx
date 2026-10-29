// @ai-generated
import React, {useMemo, useState} from 'react';
import {View, Text, Pressable, ScrollView, Alert, Linking} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {Theme} from '@/utils/themeUtils';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
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

export default function LanguageScreen() {
  const {theme} = useTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          {languageFollowsSystemSettings
            ? t('language.iosNote')
            : t('language.restartNote')}
        </Text>

        <View style={styles.optionsContainer}>
          {options.map(option => {
            const isSelected = option.value === selected;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{selected: isSelected}}
                style={({pressed}) => [
                  styles.card,
                  isSelected && styles.selectedCard,
                  pressed && styles.pressed,
                ]}
                onPress={() => handleSelect(option.value)}>
                <View style={styles.optionContent}>
                  <View style={styles.optionTextContainer}>
                    <Text
                      style={[
                        styles.optionTitle,
                        {
                          fontFamily: isSelected
                            ? 'Manrope-SemiBold'
                            : 'Manrope-Medium',
                        },
                      ]}>
                      {option.label}
                    </Text>
                    {option.hint ? (
                      <Text style={styles.optionDescription}>
                        {option.hint}
                      </Text>
                    ) : null}
                  </View>
                  {isSelected && (
                    <Feather
                      name="check"
                      size={moderateScale(20)}
                      color={Color(theme.colors.text).alpha(0.7).toString()}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
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
    scrollContent: {
      paddingHorizontal: moderateScale(16),
      paddingBottom: moderateScale(160),
    },
    subtitle: {
      textAlign: 'left',
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      marginBottom: moderateScale(24),
      lineHeight: moderateScale(18),
    },
    optionsContainer: {
      gap: moderateScale(8),
    },
    card: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderRadius: moderateScale(14),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      padding: moderateScale(14),
    },
    selectedCard: {
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    pressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    optionContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    optionTextContainer: {
      flex: 1,
    },
    optionTitle: {
      textAlign: 'left',
      fontSize: moderateScale(13.5),
      color: Color(theme.colors.text).alpha(0.85).toString(),
      marginBottom: moderateScale(2),
    },
    optionDescription: {
      textAlign: 'left',
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      lineHeight: moderateScale(17),
    },
  });
