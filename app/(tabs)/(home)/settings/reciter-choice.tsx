import React from 'react';
import {View, Text, TouchableOpacity, Switch, ScrollView} from 'react-native';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {Icon} from '@rneui/base';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Header from '@/components/Header';
import Color from 'color';
import {useSettings} from '@/hooks/useSettings';
import Animated, {FadeIn} from 'react-native-reanimated';

export default function ReciterChoiceScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    askEveryTime,
    setAskEveryTime,
    defaultReciterSelection,
    setDefaultReciterSelection,
  } = useSettings();

  const options = [
    {
      label: 'Browse All Reciters',
      action: 'browseAll',
      description: 'Search through our complete collection of reciters',
      icon: 'search1',
      iconType: 'antdesign',
    },
    {
      label: 'Use Default Reciter',
      action: 'useDefault',
      description: 'Always use your selected default reciter',
      icon: 'user',
      iconType: 'feather',
    },
  ];

  return (
    <View style={styles.container}>
      <Header title="Reciter Choice" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {paddingTop: insets.top + moderateScale(56)},
        ]}
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.delay(100)}>
          <Text style={[styles.subtitle, {color: theme.colors.textSecondary}]}>
            Choose how you want to select reciters when playing Surahs
          </Text>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
              Selection Preference
            </Text>
            <View style={[styles.card, {backgroundColor: theme.colors.card}]}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text
                    style={[styles.settingTitle, {color: theme.colors.text}]}>
                    Ask Every Time
                  </Text>
                  <Text
                    style={[
                      styles.settingDescription,
                      {color: theme.colors.textSecondary},
                    ]}>
                    Choose a reciter each time you play
                  </Text>
                </View>
                <Switch
                  value={askEveryTime}
                  onValueChange={() => setAskEveryTime(!askEveryTime)}
                  trackColor={{
                    false: Color(theme.colors.border).alpha(0.3).toString(),
                    true: Color(theme.colors.text).alpha(0.6).toString(),
                  }}
                  thumbColor={theme.colors.background}
                  ios_backgroundColor={Color(theme.colors.border)
                    .alpha(0.3)
                    .toString()}
                />
              </View>
            </View>
          </View>

          {!askEveryTime && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
                Default Selection Method
              </Text>
              <View style={styles.optionsContainer}>
                {options.map(option => (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    key={option.action}
                    style={[
                      styles.card,
                      {backgroundColor: theme.colors.card},
                      defaultReciterSelection === option.action && [
                        styles.selectedCard,
                        {
                          backgroundColor: Color(theme.colors.text)
                            .alpha(0.05)
                            .toString(),
                          borderColor: Color(theme.colors.text)
                            .alpha(0.2)
                            .toString(),
                        },
                      ],
                    ]}
                    onPress={() => setDefaultReciterSelection(option.action)}>
                    <View style={styles.optionContent}>
                      <View
                        style={[
                          styles.iconContainer,
                          {
                            backgroundColor:
                              defaultReciterSelection === option.action
                                ? Color(theme.colors.text)
                                    .alpha(0.1)
                                    .toString()
                                : Color(theme.colors.card)
                                    .lighten(0.1)
                                    .toString(),
                          },
                        ]}>
                        <Icon
                          name={option.icon}
                          type={option.iconType}
                          size={moderateScale(20)}
                          color={theme.colors.text}
                        />
                      </View>
                      <View style={styles.optionTextContainer}>
                        <Text
                          style={[
                            styles.optionTitle,
                            {
                              color: theme.colors.text,
                              fontFamily:
                                defaultReciterSelection === option.action
                                  ? theme.fonts.semiBold
                                  : theme.fonts.medium,
                            },
                          ]}>
                          {option.label}
                        </Text>
                        <Text
                          style={[
                            styles.optionDescription,
                            {color: theme.colors.textSecondary},
                          ]}>
                          {option.description}
                        </Text>
                      </View>
                      {defaultReciterSelection === option.action && (
                        <Icon
                          name="check-circle"
                          type="feather"
                          size={24}
                          color={Color(theme.colors.text).alpha(0.8).toString()}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </Animated.View>
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
      fontSize: moderateScale(14),
      marginBottom: moderateScale(24),
      fontFamily: theme.fonts.regular,
      lineHeight: moderateScale(20),
    },
    section: {
      marginBottom: moderateScale(24),
    },
    sectionTitle: {
      fontSize: moderateScale(18),
      fontFamily: theme.fonts.semiBold,
      marginBottom: moderateScale(12),
    },
    card: {
      borderRadius: moderateScale(12),
      padding: moderateScale(16),
      marginBottom: moderateScale(8),
      borderWidth: 1,
      borderColor: 'transparent',
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    settingInfo: {
      flex: 1,
    },
    settingTitle: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.medium,
      marginBottom: moderateScale(4),
    },
    settingDescription: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
      lineHeight: moderateScale(20),
    },
    optionsContainer: {
      gap: moderateScale(8),
    },
    selectedCard: {
      borderWidth: 1,
    },
    optionContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: moderateScale(40),
      height: moderateScale(40),
      borderRadius: moderateScale(20),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: moderateScale(12),
    },
    optionTextContainer: {
      flex: 1,
    },
    optionTitle: {
      fontSize: moderateScale(16),
      marginBottom: moderateScale(4),
    },
    optionDescription: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
      lineHeight: moderateScale(18),
    },
  }); 