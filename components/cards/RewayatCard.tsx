import React, {useState, useMemo} from 'react';
import {TouchableOpacity, Text, View, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {RewayatInfo} from '@/data/rewayatCollections';
import {LinearGradient} from 'expo-linear-gradient';
import {useTheme} from '@/hooks/useTheme';
import Color from 'color';

interface RewayatCardProps {
  rewayat: RewayatInfo;
  onPress: () => void;
  width?: number;
  height?: number;
}

// Sophisticated gradient colors for each rewayat
const gradientColors: Record<string, [string, string]> = {
  'warsh-an-nafi': ['#6366f1', '#8b5cf6'],
  'qalon-an-nafi': ['#ec4899', '#f43f5e'],
  'aldorai-an-alkisaai': ['#06b6d4', '#3b82f6'],
  'aldori-an-abi-amr': ['#10b981', '#14b8a6'],
  'shubah-an-assem': ['#f59e0b', '#ef4444'],
  'assosi-an-abi-amr': ['#8b5cf6', '#6366f1'],
  'albizi-an-ibn-katheer': ['#ec4899', '#a855f7'],
  'ibn-thakwan-an-ibn-amer': ['#f43f5e', '#fb923c'],
  'khalaf-an-hamzah': ['#f97316', '#fb923c'],
  'rowis-rawh-an-yakoob': ['#06b6d4', '#0ea5e9'],
  'warsh-tariq-alazraq': ['#a855f7', '#ec4899'],
};

function RewayatCard({
  rewayat,
  onPress,
  width = moderateScale(140),
  height = moderateScale(120),
}: RewayatCardProps) {
  const {theme} = useTheme();
  const [isPressed, setIsPressed] = useState(false);

  // Get gradient colors for this rewayat, fallback to default
  const colors = useMemo(() => {
    if (theme.isDarkMode) {
      return gradientColors[rewayat.id] || ['#6366f1', '#8b5cf6'];
    }
    // Lighter versions for light mode
    const darkColors = gradientColors[rewayat.id] || ['#6366f1', '#8b5cf6'];
    return [
      Color(darkColors[0]).lighten(0.3).hex(),
      Color(darkColors[1]).lighten(0.3).hex(),
    ] as [string, string];
  }, [rewayat.id, theme.isDarkMode]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={[
        styles.container,
        {
          width,
          height,
        },
      ]}
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}>
      <LinearGradient
        colors={colors}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={[styles.gradient, isPressed && styles.gradientPressed]}>
        <View style={styles.content}>
          <Text style={styles.displayName} numberOfLines={2}>
            {rewayat.displayName}
          </Text>
          <Text style={styles.description} numberOfLines={1}>
            {rewayat.reciterCount}{' '}
            {rewayat.reciterCount === 1 ? 'Reciter' : 'Reciters'}
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: moderateScale(12),
    overflow: 'hidden',
  },
  gradient: {
    width: '100%',
    height: '100%',
    padding: moderateScale(14),
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  gradientPressed: {
    opacity: 0.8,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    width: '100%',
  },
  displayName: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    marginBottom: verticalScale(6),
    lineHeight: moderateScale(20),
  },
  description: {
    fontSize: moderateScale(11),
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.3,
  },
});

export default React.memo(RewayatCard);
