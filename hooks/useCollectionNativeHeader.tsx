import React, {useLayoutEffect} from 'react';
import {Animated as RNAnimated, Platform} from 'react-native';
import {useNavigation} from 'expo-router';
import {useTheme} from './useTheme';

interface UseCollectionNativeHeaderOptions {
  title: string;
  scrollY: RNAnimated.Value;
  hasContent: boolean;
  headerRight?: () => React.ReactNode;
  threshold?: number;
}

export function useCollectionNativeHeader({
  title,
  scrollY,
  hasContent,
  headerRight,
  threshold = 120,
}: UseCollectionNativeHeaderOptions) {
  const navigation = useNavigation();
  const {theme} = useTheme();

  useLayoutEffect(() => {
    if (Platform.OS !== 'ios') return;

    navigation.setOptions({
      headerTitle: hasContent
        ? () => (
            <RNAnimated.Text
              style={{
                opacity: scrollY.interpolate({
                  inputRange: [threshold - 40, threshold],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
                fontFamily: 'Manrope-SemiBold',
                fontSize: 17,
                color: theme.colors.text,
              }}
              numberOfLines={1}>
              {title}
            </RNAnimated.Text>
          )
        : title,
      headerRight: headerRight ?? undefined,
    });
  }, [
    navigation,
    hasContent,
    title,
    headerRight,
    theme.colors.text,
    scrollY,
    threshold,
  ]);
}
