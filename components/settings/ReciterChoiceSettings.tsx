import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useSettings} from '@/hooks/useSettings';
import {Switch} from 'react-native-gesture-handler';
import {Icon} from '@rneui/themed';
import Color from 'color';
import {StarIcon} from '@/components/Icons';

export default function ReciterChoiceSettings() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
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
      label: 'Search from Favorites',
      action: 'searchFavorites',
      description: 'Quick access to your favorite reciters',
      icon: (
        <StarIcon
          size={24}
          color={
            defaultReciterSelection === 'searchFavorites'
              ? theme.colors.primary
              : theme.colors.text
          }
        />
      ),
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
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          Choose how you want to select reciters when playing Surahs
        </Text>
      </View>

      <View style={styles.toggleCard}>
        <View style={styles.toggleContent}>
          <Text style={styles.toggleTitle}>Ask Every Time</Text>
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
          <Text style={styles.sectionTitle}>Default Selection Method</Text>
          {options.map(option => (
            <TouchableOpacity
              key={option.action}
              style={[
                styles.optionCard,
                defaultReciterSelection === option.action &&
                  styles.selectedCard,
              ]}
              onPress={() => setDefaultReciterSelection(option.action)}>
              <View style={styles.optionContent}>
                <View style={styles.iconContainer}>
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
                  <Text style={styles.optionTitle}>{option.label}</Text>
                  <Text style={styles.optionDescription}>
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
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: moderateScale(16),
    },
    header: {
      marginBottom: verticalScale(16),
    },
    subtitle: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
    },
    toggleCard: {
      backgroundColor: theme.colors.card,
      borderRadius: moderateScale(12),
      padding: moderateScale(16),
      marginBottom: verticalScale(16),
    },
    toggleContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    toggleTitle: {
      fontSize: moderateScale(16),
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: verticalScale(2),
      flex: 1,
      alignSelf: 'center',
    },

    optionsContainer: {
      gap: moderateScale(8),
    },
    sectionTitle: {
      fontSize: moderateScale(18),
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: verticalScale(8),
    },
    optionCard: {
      backgroundColor: theme.colors.card,
      borderRadius: moderateScale(12),
      padding: moderateScale(12),
      marginBottom: moderateScale(8),
    },
    selectedCard: {
      backgroundColor: Color(theme.colors.primary).alpha(0.1).toString(),
      borderColor: theme.colors.primary,
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
      backgroundColor: theme.colors.background,
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
      color: theme.colors.text,
      marginBottom: verticalScale(2),
    },
    optionDescription: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
    },
  });
