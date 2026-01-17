import React, {useState} from 'react';
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

// Subtle accent colors for each rewayat
const accentColors: Record<string, string> = {
  'warsh-an-nafi': '#6366f1',
  'qalon-an-nafi': '#ec4899',
  'aldorai-an-alkisaai': '#06b6d4',
  'aldori-an-abi-amr': '#10b981',
  'shubah-an-assem': '#f59e0b',
  'assosi-an-abi-amr': '#8b5cf6',
  'albizi-an-ibn-katheer': '#a855f7',
  'ibn-thakwan-an-ibn-amer': '#f43f5e',
  'khalaf-an-hamzah': '#f97316',
  'rowis-rawh-an-yakoob': '#0ea5e9',
  'warsh-tariq-alazraq': '#a855f7',
};

function RewayatCard({
  rewayat,
  onPress,
  width = moderateScale(140),
  height = moderateScale(120),
}: RewayatCardProps) {
  const {theme} = useTheme();
  const [isPressed, setIsPressed] = useState(false);

  const accentColor = accentColors[rewayat.id] || '#6366f1';

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={[
        styles.container,
        {
          width,
          height,
          backgroundColor: theme.colors.card,
          borderColor: Color(theme.colors.border).alpha(0.15).toString(),
        },
        isPressed && {
          backgroundColor: Color(theme.colors.text).alpha(0.05).toString(),
        },
      ]}
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}>
      {/* Accent line at top */}
      <View
        style={[
          styles.accentLine,
          {
            backgroundColor: accentColor,
          },
        ]}
      />

      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.displayName,
              {
                color: theme.colors.text,
              },
            ]}
            numberOfLines={2}>
            {rewayat.displayName}
          </Text>
          <Text
            style={[
              styles.description,
              {
                color: theme.colors.textSecondary,
              },
            ]}
            numberOfLines={1}>
            {rewayat.reciterCount}{' '}
            {rewayat.reciterCount === 1 ? 'Reciter' : 'Reciters'}
          </Text>
        </View>

        {/* Decorative circle in corner */}
        <View
          style={[
            styles.decorativeCircle,
            {
              backgroundColor: Color(accentColor).alpha(0.1).toString(),
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: moderateScale(12),
    overflow: 'hidden',
    borderWidth: 0.5,
  },
  accentLine: {
    height: moderateScale(3),
    width: '100%',
  },
  content: {
    flex: 1,
    padding: moderateScale(14),
    position: 'relative',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  displayName: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    letterSpacing: 0.1,
    marginBottom: verticalScale(4),
    lineHeight: moderateScale(18),
  },
  description: {
    fontSize: moderateScale(11),
    fontWeight: '500',
    letterSpacing: 0.2,
    opacity: 0.8,
  },
  decorativeCircle: {
    position: 'absolute',
    bottom: -moderateScale(20),
    right: -moderateScale(20),
    width: moderateScale(60),
    height: moderateScale(60),
    borderRadius: moderateScale(30),
  },
});

export default React.memo(RewayatCard);
