import React, {useState, useMemo} from 'react';
import {TouchableOpacity, Text, View, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {RewayatInfo} from '@/data/rewayatCollections';
import {useTheme} from '@/hooks/useTheme';
import Color from 'color';

interface RewayatCardProps {
  rewayat: RewayatInfo;
  onPress: () => void;
  width?: number;
  height?: number;
}

function RewayatCard({
  rewayat,
  onPress,
  width = moderateScale(130),
  height = moderateScale(100),
}: RewayatCardProps) {
  const {theme} = useTheme();
  const [isPressed, setIsPressed] = useState(false);

  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={[
        styles.container,
        {width, height},
        isPressed && styles.containerPressed,
      ]}
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}>
      <Text style={styles.displayName} numberOfLines={2}>
        {rewayat.displayName}
      </Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{rewayat.reciterCount}</Text>
      </View>
    </TouchableOpacity>
  );
}

function createStyles(theme: {
  colors: {text: string; textSecondary: string; card: string; border: string};
  fonts: {semiBold: string; medium: string};
  isDarkMode: boolean;
}) {
  return StyleSheet.create({
    container: {
      borderRadius: moderateScale(16),
      backgroundColor: theme.isDarkMode
        ? Color(theme.colors.card).lighten(0.1).toString()
        : Color(theme.colors.card).darken(0.02).toString(),
      padding: moderateScale(16),
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.isDarkMode
        ? Color(theme.colors.border).alpha(0.08).toString()
        : Color(theme.colors.border).alpha(0.12).toString(),
    },
    containerPressed: {
      transform: [{scale: 0.97}],
      opacity: 0.9,
    },
    displayName: {
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
      letterSpacing: -0.2,
      lineHeight: moderateScale(20),
    },
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.isDarkMode
        ? Color(theme.colors.text).alpha(0.08).toString()
        : Color(theme.colors.text).alpha(0.06).toString(),
      paddingHorizontal: moderateScale(8),
      paddingVertical: verticalScale(3),
      borderRadius: moderateScale(6),
      marginTop: verticalScale(8),
    },
    badgeText: {
      fontSize: moderateScale(11),
      fontFamily: theme.fonts.medium,
      color: theme.colors.textSecondary,
      letterSpacing: 0.2,
    },
  });
}

export default React.memo(RewayatCard);
