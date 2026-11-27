import React, {useEffect, useLayoutEffect, useState} from 'react';
import {Animated as RNAnimated} from 'react-native';
import {useNavigation} from 'expo-router';
import {useTheme} from './useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {tintedHeaderRight} from '@/components/TintedHeader'; // @ai

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
  // @ai-start
  // Once the list scrolls under the bar, give the bar a blurred background
  // so rows and headings don't run into the back button and title.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!USE_GLASS) return;
    const id = scrollY.addListener(({value}) => setScrolled(value > 4));
    return () => scrollY.removeListener(id);
  }, [scrollY]);
  // @ai-end

  useLayoutEffect(() => {
    if (!USE_GLASS) return;

    navigation.setOptions({
      // VoiceOver and the back menu read `title`; without it they read the
      // route name ("collection/loved"). @ai
      title,
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
      // @ai: the actions sit in the tinted glass pill
      ...tintedHeaderRight(headerRight ?? undefined),
      headerBlurEffect: scrolled // @ai
        ? theme.isDarkMode
          ? 'systemChromeMaterialDark'
          : 'systemChromeMaterialLight'
        : undefined,
    });
  }, [
    navigation,
    hasContent,
    title,
    headerRight,
    theme.colors.text,
    theme.isDarkMode, // @ai
    scrolled, // @ai
    scrollY,
    threshold,
  ]);
}
