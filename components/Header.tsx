import React from 'react';
import {View, Text, Pressable, ViewStyle, StyleSheet} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

interface HeaderProps {
  title: string;
  onBack: () => void;
  showBlur?: boolean;
  containerStyle?: ViewStyle;
  titleStyle?: ViewStyle;
  backButtonStyle?: ViewStyle;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onBack,
  showBlur = true,
  containerStyle,
  titleStyle,
  backButtonStyle,
}) => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);

  return (
    <View style={[styles.header, {paddingTop: insets.top}, containerStyle]}>
      {showBlur && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {backgroundColor: theme.colors.background},
          ]}
        />
      )}
      <View style={styles.headerContent}>
        <Pressable
          style={[styles.backButton, backButtonStyle]}
          onPress={onBack}>
          <Feather
            name="arrow-left"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </Pressable>
        <Text style={[styles.headerTitle, titleStyle]}>{title}</Text>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
    },
    headerContent: {
      height: moderateScale(56),
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(16),
      position: 'relative',
    },
    backButton: {
      padding: moderateScale(10),
      width: moderateScale(44),
      height: moderateScale(44),
      justifyContent: 'center',
      alignItems: 'center',
      position: 'absolute',
      left: moderateScale(16),
      zIndex: 1,
    },
    headerTitle: {
      fontSize: moderateScale(18),
      fontFamily: theme.fonts.semiBold,
      textAlign: 'center',
      width: '100%',
      color: theme.colors.text,
    },
  });

export default Header;
