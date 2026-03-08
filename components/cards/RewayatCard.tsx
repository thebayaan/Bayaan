import React, {useMemo} from 'react';
import {Pressable, Text, View, StyleSheet, Platform} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {RewayatInfo} from '@/data/rewayatCollections';
import {useTheme} from '@/hooks/useTheme';
import Color from 'color';
import {Link} from 'expo-router';
import {GlassView, isLiquidGlassAvailable} from 'expo-glass-effect';

const USE_GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

interface RewayatCardProps {
  rewayat: RewayatInfo;
  onPress: () => void;
  width?: number;
  height?: number;
}

function RewayatCard({
  rewayat,
  onPress,
  width = moderateScale(110),
  height = moderateScale(92),
}: RewayatCardProps) {
  const {theme} = useTheme();
  const styles = useMemo(
    () => createStyles(theme, width, height),
    [theme, width, height],
  );

  const linkHref = {
    pathname: '/(tabs)/(a.home)/reciter/browse' as const,
    params: {
      teacher: rewayat.teacher,
      student: rewayat.student,
      rewayatName: rewayat.displayName,
    },
  };

  const content = (
    <View style={styles.content}>
      <Text style={styles.teacherLabel} numberOfLines={1}>
        {rewayat.teacher}
      </Text>
      <View style={styles.textContainer}>
        <Text style={styles.displayName} numberOfLines={2}>
          {rewayat.displayName}
        </Text>
        <Text style={styles.subtitle}>
          {rewayat.reciterCount} reciter{rewayat.reciterCount !== 1 && 's'}
        </Text>
      </View>
    </View>
  );

  if (USE_GLASS) {
    return (
      <Link href={linkHref} asChild>
        <Pressable>
          <Link.AppleZoom>
            <GlassView
              style={StyleSheet.flatten([
                styles.container,
                styles.glassContainer,
              ])}
              glassEffectStyle="regular">
              {content}
            </GlassView>
          </Link.AppleZoom>
        </Pressable>
      </Link>
    );
  }

  return (
    <Link href={linkHref} asChild>
      <Pressable style={styles.container}>
        <Link.AppleZoom>
          <View style={{flex: 1}}>{content}</View>
        </Link.AppleZoom>
      </Pressable>
    </Link>
  );
}

function createStyles(
  theme: {
    colors: {
      text: string;
      textSecondary: string;
      card: string;
      border: string;
      background: string;
    };
    fonts: {semiBold: string; regular: string; medium: string};
    isDarkMode: boolean;
  },
  width: number,
  height: number,
) {
  return StyleSheet.create({
    container: {
      width,
      height,
      borderRadius: moderateScale(14),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    glassContainer: {
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
    content: {
      flex: 1,
      padding: moderateScale(10),
      justifyContent: 'space-between',
    },
    teacherLabel: {
      fontSize: moderateScale(9),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    textContainer: {
      gap: moderateScale(2),
    },
    displayName: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
      letterSpacing: -0.3,
      lineHeight: moderateScale(18),
    },
    subtitle: {
      fontSize: moderateScale(10),
      fontFamily: theme.fonts.regular,
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
    },
    pressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
  });
}

export default React.memo(RewayatCard);
