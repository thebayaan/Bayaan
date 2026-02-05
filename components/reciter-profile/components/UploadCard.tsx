import React, {useMemo} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {LinearGradient} from 'expo-linear-gradient';
import {Icon} from '@rneui/themed';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';

interface UploadCardProps {
  title: string;
  subtitle: string;
  onPress: () => void;
  onLongPress?: () => void;
  color: string;
  style?: StyleProp<ViewStyle>;
}

export const UploadCard: React.FC<UploadCardProps> = ({
  title,
  subtitle,
  onPress,
  onLongPress,
  color,
  style,
}) => {
  const {theme} = useTheme();

  const gradientColors = useMemo((): [string, string] => {
    const base = Color(theme.colors.textSecondary);
    return [base.alpha(0.08).toString(), base.alpha(0.03).toString()];
  }, [theme.colors.textSecondary]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          width: moderateScale(120),
          height: moderateScale(120),
          borderRadius: moderateScale(12),
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: Color(theme.colors.border).alpha(0.15).toString(),
        },
        content: {
          flex: 1,
          padding: moderateScale(8),
          justifyContent: 'center',
          alignItems: 'center',
        },
        iconContainer: {
          marginBottom: moderateScale(8),
        },
        title: {
          fontSize: moderateScale(12),
          fontFamily: 'Manrope-Bold',
          color: theme.colors.text,
          textAlign: 'center',
          numberOfLines: 2,
        },
        subtitle: {
          fontSize: moderateScale(9),
          fontFamily: 'Manrope-Medium',
          color: theme.colors.textSecondary,
          textAlign: 'center',
          marginTop: moderateScale(2),
        },
      }),
    [theme],
  );

  return (
    <Pressable
      style={[styles.container, style]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}>
      <LinearGradient
        colors={gradientColors}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon
            name="music"
            type="feather"
            size={moderateScale(22)}
            color={theme.colors.textSecondary}
          />
        </View>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
};
