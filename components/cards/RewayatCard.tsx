import React, {useState} from 'react';
import {TouchableOpacity, Text, View, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import Color from 'color';
import {RewayatInfo} from '@/data/rewayatCollections';

interface RewayatCardProps {
  rewayat: RewayatInfo;
  onPress: () => void;
  width?: number;
  height?: number;
}

function RewayatCard({
  rewayat,
  onPress,
  width = moderateScale(140),
  height = moderateScale(120),
}: RewayatCardProps) {
  const {theme} = useTheme();
  const [isPressed, setIsPressed] = useState(false);

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={[
        styles.container,
        {
          width,
          height,
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
        isPressed && {
          backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
        },
      ]}
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}>
      <View style={styles.content}>
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
            styles.reciterCount,
            {
              color: theme.colors.textSecondary,
            },
          ]}
          numberOfLines={1}>
          {rewayat.reciterCount}{' '}
          {rewayat.reciterCount === 1 ? 'Reciter' : 'Reciters'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: moderateScale(12),
    borderWidth: 1,
    marginRight: moderateScale(12),
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    padding: moderateScale(16),
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayName: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: verticalScale(8),
  },
  reciterCount: {
    fontSize: moderateScale(12),
    fontWeight: '400',
    textAlign: 'center',
  },
});

export default React.memo(RewayatCard);
