import React, {useState, useMemo} from 'react';
import {TouchableOpacity, Text, View, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {RewayatInfo} from '@/data/rewayatCollections';
import {LinearGradient} from 'expo-linear-gradient';
import {Icon} from '@rneui/base';

interface RewayatCardProps {
  rewayat: RewayatInfo;
  onPress: () => void;
  width?: number;
  height?: number;
}

// Elegant gradient colors for each rewayat
const gradientColors: Record<string, [string, string]> = {
  'warsh-an-nafi': ['#667eea', '#764ba2'],
  'qalon-an-nafi': ['#f093fb', '#f5576c'],
  'aldorai-an-alkisaai': ['#4facfe', '#00f2fe'],
  'aldori-an-abi-amr': ['#43e97b', '#38f9d7'],
  'shubah-an-assem': ['#fa709a', '#fee140'],
  'assosi-an-abi-amr': ['#30cfd0', '#330867'],
  'albizi-an-ibn-katheer': ['#a8edea', '#fed6e3'],
  'ibn-thakwan-an-ibn-amer': ['#ff9a9e', '#fecfef'],
  'khalaf-an-hamzah': ['#ffecd2', '#fcb69f'],
  'rowis-rawh-an-yakoob': ['#ff6e7f', '#bfe9ff'],
  'warsh-tariq-alazraq': ['#e0c3fc', '#8ec5fc'],
};

function RewayatCard({
  rewayat,
  onPress,
  width = moderateScale(140),
  height = moderateScale(120),
}: RewayatCardProps) {
  const [isPressed, setIsPressed] = useState(false);

  // Get gradient colors for this rewayat, fallback to default
  const colors = useMemo(
    () => gradientColors[rewayat.id] || ['#667eea', '#764ba2'],
    [rewayat.id],
  );

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
        <View style={styles.overlay} />
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Icon
              name="book-open"
              type="feather"
              size={moderateScale(24)}
              color="rgba(255, 255, 255, 0.9)"
            />
          </View>
          <Text style={styles.displayName} numberOfLines={2}>
            {rewayat.displayName}
          </Text>
          <View style={styles.countBadge}>
            <Text style={styles.reciterCount} numberOfLines={1}>
              {rewayat.reciterCount}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: moderateScale(16),
    marginRight: moderateScale(12),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  gradient: {
    flex: 1,
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    justifyContent: 'space-between',
    minHeight: moderateScale(120),
  },
  gradientPressed: {
    opacity: 0.85,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  iconContainer: {
    marginBottom: verticalScale(8),
  },
  displayName: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    textAlign: 'center',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
    letterSpacing: 0.3,
    flex: 1,
    justifyContent: 'center',
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(12),
    marginTop: verticalScale(8),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  reciterCount: {
    fontSize: moderateScale(11),
    fontWeight: '600',
    textAlign: 'center',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 1,
  },
});

export default React.memo(RewayatCard);
