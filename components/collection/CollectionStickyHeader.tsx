import React from 'react';
import {
  Animated as RNAnimated,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {Feather} from '@expo/vector-icons';

interface CollectionStickyHeaderProps {
  title: string;
  scrollY: RNAnimated.Value;
  threshold?: number;
}

export const CollectionStickyHeader: React.FC<CollectionStickyHeaderProps> = ({
  title,
  scrollY,
  threshold = 120,
}) => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const headerOpacity = scrollY.interpolate({
    inputRange: [threshold - 40, threshold],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <RNAnimated.View
      style={[
        styles.stickyHeader,
        {
          opacity: headerOpacity,
          paddingTop: insets.top,
        },
      ]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          {backgroundColor: theme.colors.background},
        ]}
      />
      <View style={styles.headerContent}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={8}>
          <Feather
            name="arrow-left"
            size={moderateScale(22)}
            color={theme.colors.text}
          />
        </Pressable>
        <Text
          style={[styles.stickyHeaderTitle, {color: theme.colors.text}]}
          numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.backButton} />
      </View>
    </RNAnimated.View>
  );
};

const styles = StyleSheet.create({
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: moderateScale(12),
    paddingHorizontal: moderateScale(16),
  },
  backButton: {
    width: moderateScale(36),
    height: moderateScale(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickyHeaderTitle: {
    flex: 1,
    fontSize: moderateScale(17),
    fontFamily: 'Manrope-Bold',
    textAlign: 'center',
  },
});
