import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {
  SheetProps,
  SheetManager,
} from 'react-native-actions-sheet';
import {Feather} from '@expo/vector-icons';
import Color from 'color';

export const CollectionOptionsSheet = (
  props: SheetProps<'collection-options'>,
) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const payload = props.payload;
  const title = payload?.title ?? '';
  const subtitle = payload?.subtitle;
  const options = payload?.options ?? [];

  // Separate destructive from non-destructive options
  const normalOptions = options.filter(opt => !opt.destructive);
  const destructiveOptions = options.filter(opt => opt.destructive);

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {normalOptions.length > 0 && (
          <View style={styles.card}>
            {normalOptions.map((opt, i) => (
              <React.Fragment key={i}>
                {i > 0 && <View style={styles.divider} />}
                <Pressable
                  style={({pressed}) => [
                    styles.option,
                    pressed && styles.optionPressed,
                    opt.disabled && styles.optionDisabled,
                  ]}
                  onPress={() => {
                    SheetManager.hide('collection-options');
                    opt.onPress();
                  }}
                  disabled={opt.disabled}>
                  {opt.customIcon || (
                    <Feather
                      name={opt.icon as any}
                      size={moderateScale(18)}
                      color={theme.colors.text}
                    />
                  )}
                  <Text style={styles.optionText}>{opt.label}</Text>
                </Pressable>
              </React.Fragment>
            ))}
          </View>
        )}

        {destructiveOptions.map((opt, i) => (
          <View key={`destructive-${i}`} style={styles.destructiveCard}>
            <Pressable
              style={({pressed}) => [
                styles.optionDestructive,
                pressed && styles.optionDestructivePressed,
                opt.disabled && styles.optionDisabled,
              ]}
              onPress={() => {
                SheetManager.hide('collection-options');
                opt.onPress();
              }}
              disabled={opt.disabled}>
              {opt.customIcon || (
                <Feather
                  name={opt.icon as any}
                  size={moderateScale(18)}
                  color="#ff4444"
                />
              )}
              <Text style={styles.optionTextDestructive}>{opt.label}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
      paddingTop: moderateScale(8),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
      height: 2.5,
    },
    container: {
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(40),
    },
    header: {
      alignItems: 'center',
      marginTop: moderateScale(4),
      marginBottom: moderateScale(14),
      gap: moderateScale(2),
    },
    title: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      textAlign: 'center',
    },
    card: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(12),
      overflow: 'hidden',
      marginBottom: moderateScale(8),
    },
    divider: {
      height: 1,
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      marginHorizontal: moderateScale(14),
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(11),
      paddingHorizontal: moderateScale(14),
    },
    optionDisabled: {
      opacity: 0.5,
    },
    optionPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    optionText: {
      flex: 1,
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginLeft: moderateScale(10),
    },
    destructiveCard: {
      backgroundColor: 'rgba(255, 68, 68, 0.1)',
      borderRadius: moderateScale(12),
      overflow: 'hidden',
      marginBottom: moderateScale(8),
    },
    optionDestructive: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(11),
      paddingHorizontal: moderateScale(14),
    },
    optionDestructivePressed: {
      backgroundColor: 'rgba(255, 68, 68, 0.18)',
    },
    optionTextDestructive: {
      flex: 1,
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: '#ff4444',
      marginLeft: moderateScale(10),
    },
  });
