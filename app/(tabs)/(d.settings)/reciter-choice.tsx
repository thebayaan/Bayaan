import React, {useMemo} from 'react';
import {View, Text, Pressable, Switch, ScrollView} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {AntDesign, Feather} from '@expo/vector-icons';
import Color from 'color';
import {useSettings} from '@/hooks/useSettings';

export default function ReciterChoiceScreen() {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {
    askEveryTime,
    setAskEveryTime,
    defaultReciterSelection,
    setDefaultReciterSelection,
  } = useSettings();

  const trackColor = useMemo(
    () => ({
      false: Color(theme.colors.text).alpha(0.1).toString(),
      true: Color(theme.colors.text).alpha(0.65).toString(),
    }),
    [theme.colors.text],
  );

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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Choose how you want to select reciters when playing Surahs
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SELECTION PREFERENCE</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Ask Every Time</Text>
                <Text style={styles.settingDescription}>
                  Choose a reciter each time you play
                </Text>
              </View>
              <Switch
                value={askEveryTime}
                onValueChange={() => setAskEveryTime(!askEveryTime)}
                trackColor={trackColor}
                thumbColor="#FFFFFF"
                ios_backgroundColor={trackColor.false}
                style={styles.switchStyle}
              />
            </View>
          </View>
        </View>

        {!askEveryTime && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>DEFAULT SELECTION METHOD</Text>
            <View style={styles.optionsContainer}>
              {options.map(option => {
                const isSelected = defaultReciterSelection === option.action;
                return (
                  <Pressable
                    key={option.action}
                    style={({pressed}) => [
                      styles.card,
                      isSelected && styles.selectedCard,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setDefaultReciterSelection(option.action)}>
                    <View style={styles.optionContent}>
                      <View
                        style={[
                          styles.iconContainer,
                          {
                            backgroundColor: isSelected
                              ? Color(theme.colors.text).alpha(0.08).toString()
                              : Color(theme.colors.text).alpha(0.04).toString(),
                          },
                        ]}>
                        {option.iconType === 'antdesign' ? (
                          <AntDesign
                            name={option.icon as any}
                            size={moderateScale(20)}
                            color={Color(theme.colors.text)
                              .alpha(0.7)
                              .toString()}
                          />
                        ) : (
                          <Feather
                            name={option.icon as any}
                            size={moderateScale(20)}
                            color={Color(theme.colors.text)
                              .alpha(0.7)
                              .toString()}
                          />
                        )}
                      </View>
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
                        <Text style={styles.optionDescription}>
                          {option.description}
                        </Text>
                      </View>
                      {isSelected && (
                        <Feather
                          name="check-circle"
                          size={moderateScale(20)}
                          color={Color(theme.colors.text).alpha(0.7).toString()}
                        />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
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
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      marginBottom: moderateScale(24),
      lineHeight: moderateScale(18),
    },
    section: {
      marginBottom: moderateScale(24),
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
      padding: moderateScale(14),
      marginBottom: moderateScale(8),
    },
    selectedCard: {
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    pressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    settingInfo: {
      flex: 1,
      marginRight: moderateScale(12),
    },
    settingTitle: {
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.text).alpha(0.85).toString(),
      marginBottom: moderateScale(2),
    },
    settingDescription: {
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      lineHeight: moderateScale(17),
    },
    switchStyle: {
      transform: [{scaleX: 0.8}, {scaleY: 0.8}],
    },
    optionsContainer: {
      gap: moderateScale(8),
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
      fontSize: moderateScale(13.5),
      color: Color(theme.colors.text).alpha(0.85).toString(),
      marginBottom: moderateScale(2),
    },
    optionDescription: {
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      lineHeight: moderateScale(17),
    },
  });
