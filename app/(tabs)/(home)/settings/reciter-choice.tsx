import React, {useState} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {Icon} from '@rneui/base';
import {useReciterChoice} from '@/hooks/useReciterChoice';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Header from '@/components/Header';

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
    },
    {
      label: 'Use Default Reciter',
      action: 'useDefault',
      description: 'Always use your selected default reciter',
      icon: 'user',
    },
  ];

  return (
    <View style={styles.container}>
      <Header title="Reciter Choice" onBack={() => router.back()} />

      <View style={[styles.content, {paddingTop: insets.top + moderateScale(56)}]}>
        <View style={styles.header}>
          <Text style={[styles.subtitle, {color: theme.colors.textSecondary}]}>
            Choose how you want to select reciters when playing Surahs
          </Text>
        </View>

        <View style={[styles.toggleCard, {backgroundColor: theme.colors.card}]}>
          <View style={styles.toggleContent}>
            <Text style={[styles.toggleTitle, {color: theme.colors.text}]}>
              Ask Every Time
            </Text>
            <Switch
              value={askEveryTime}
              onValueChange={() => setAskEveryTime(!askEveryTime)}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primary,
              }}
              thumbColor={theme.colors.background}
            />
          </View>
        </View>

        {!askEveryTime && (
          <View style={styles.optionsContainer}>
            <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
              Default Selection Method
            </Text>
            {options.map(option => (
              <TouchableOpacity
                activeOpacity={0.99}
                key={option.action}
                style={[
                  styles.optionCard,
                  {backgroundColor: theme.colors.card},
                  defaultReciterSelection === option.action && [
                    styles.selectedCard,
                    {
                      backgroundColor: Color(theme.colors.primary)
                        .alpha(0.1)
                        .toString(),
                      borderColor: theme.colors.primary,
                    },
                  ],
                ]}
                onPress={() => setDefaultReciterSelection(option.action)}>
                <View style={styles.optionContent}>
                  <View
                    style={[
                      styles.iconContainer,
                      {backgroundColor: theme.colors.background},
                    ]}>
                    {typeof option.icon === 'string' ? (
                      <Icon
                        name={option.icon}
                        type="antdesign"
                        size={24}
                        color={
                          defaultReciterSelection === option.action
                            ? theme.colors.primary
                            : theme.colors.text
                        }
                      />
                    ) : (
                      option.icon
                    )}
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text
                      style={[styles.optionTitle, {color: theme.colors.text}]}>
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
                      color={theme.colors.primary}
                    />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
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
      paddingHorizontal: moderateScale(16),
    },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
    },
    subtitle: {
      fontSize: moderateScale(14),
      marginBottom: moderateScale(16),
    },
    toggleCard: {
      borderRadius: moderateScale(12),
      padding: moderateScale(16),
      marginBottom: moderateScale(16),
    },
    toggleContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    toggleTitle: {
      fontSize: moderateScale(16),
      fontWeight: '600',
      marginBottom: moderateScale(2),
      flex: 1,
      alignSelf: 'center',
    },
    optionsContainer: {
      gap: moderateScale(8),
    },
    sectionTitle: {
      fontSize: moderateScale(18),
      fontWeight: '600',
      marginBottom: moderateScale(8),
    },
    optionCard: {
      borderRadius: moderateScale(12),
      padding: moderateScale(12),
      marginBottom: moderateScale(8),
    },
    selectedCard: {
      borderWidth: 1,
    },
    optionContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: moderateScale(36),
      height: moderateScale(36),
      borderRadius: moderateScale(18),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: moderateScale(12),
    },
    optionTextContainer: {
      flex: 1,
    },
    optionTitle: {
      fontSize: moderateScale(16),
      fontWeight: '600',
      marginBottom: moderateScale(2),
    },
    optionDescription: {
      fontSize: moderateScale(14),
    },
  }); 