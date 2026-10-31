import React, {useCallback, useMemo} from 'react';
import {View, Pressable, Text, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {
  HomeIcon,
  QuranIcon,
  SearchIcon,
  CollectionIcon,
  SettingsIcon,
} from '@/components/Icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {BottomTabBarProps} from 'expo-router/js-tabs';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {
  FLOATING_UI_HORIZONTAL_MARGIN,
  FLOATING_TAB_BAR_BOTTOM_MARGIN,
} from '@/utils/constants';
import {GlassView} from 'expo-glass-effect';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {FrostedView} from '@/components/FrostedView';
import {useFloatingPillStyle} from '@/hooks/useFloatingPillStyle'; // @ai
// @ai-start
import {appDirection} from '@/utils/rtl';
// @ai-end

function getIcon(
  routeName: string,
  isFocused: boolean,
  theme: Theme,
  iconSize: number,
) {
  const color = isFocused
    ? theme.colors.text
    : Color(theme.colors.text).alpha(0.5).toString();

  switch (routeName) {
    case '(a.home)':
      return <HomeIcon filled={isFocused} color={color} size={iconSize} />;
    case '(b.surahs)':
      return (
        <QuranIcon filled={isFocused} color={color} size={iconSize * 1.2} />
      );
    case '(b.search)':
      return <SearchIcon filled={isFocused} color={color} size={iconSize} />;
    case '(c.collection)':
      return (
        <CollectionIcon filled={isFocused} color={color} size={iconSize} />
      );
    case '(d.settings)':
      return <SettingsIcon filled={isFocused} color={color} size={iconSize} />;
    default:
      return null;
  }
}

interface TabItemProps {
  routeName: string;
  routeKey: string;
  label: string;
  isFocused: boolean;
  onPress: () => void;
  theme: Theme;
  iconSize: number;
}

const TabItem = React.memo(function TabItem({
  routeName,
  label,
  isFocused,
  onPress,
  theme,
  iconSize,
}: TabItemProps) {
  const labelColor = isFocused
    ? Color(theme.colors.text).alpha(0.85).toString()
    : Color(theme.colors.text).alpha(0.5).toString();

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [styles.tabButton, pressed && styles.pressed]}>
      {/* @ai: a fixed box, so the larger Surahs icon can't push its label down */}
      <View style={[styles.iconBox, {height: iconSize}]}>
        {getIcon(routeName, isFocused, theme, iconSize)}
      </View>
      <Text
        style={[
          styles.tabText,
          {
            color: labelColor,
            fontFamily: isFocused ? 'Manrope-SemiBold' : 'Manrope-Medium',
          },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
});

const BottomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  emitter,
  navigateToTab,
}) => {
  const {theme} = useTheme();
  const glassColorScheme = useGlassColorScheme();
  const insets = useSafeAreaInsets();
  const iconSize = moderateScale(22, 0.2);
  const pillStyle = useFloatingPillStyle(); // @ai

  const containerStyle = useMemo(
    () => ({
      ...pillStyle,
      position: 'absolute' as const,
      bottom: insets.bottom + FLOATING_TAB_BAR_BOTTOM_MARGIN,
      left: FLOATING_UI_HORIZONTAL_MARGIN,
      right: FLOATING_UI_HORIZONTAL_MARGIN,
    }),
    [pillStyle, insets.bottom],
  );

  const handleTabPress = useCallback(
    (route: (typeof state.routes)[number], index: number) => {
      const isFocused = state.index === index;
      const event = emitter.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigateToTab(route.key);
      }
    },
    [state.index, emitter, navigateToTab],
  );

  const Container = USE_GLASS ? GlassView : FrostedView;

  return (
    <Container
      style={containerStyle}
      {...(USE_GLASS
        ? {glassEffectStyle: 'regular' as const, colorScheme: glassColorScheme}
        : {})}>
      <View style={styles.content}>
        {state.routes.map((route, index) => {
          const {options} = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name;

          const isFocused = state.index === index;

          return (
            <TabItem
              key={route.key}
              routeName={route.name}
              routeKey={route.key}
              label={typeof label === 'string' ? label : ''}
              isFocused={isFocused}
              onPress={() => handleTabPress(route, index)}
              theme={theme}
              iconSize={iconSize}
            />
          );
        })}
      </View>
    </Container>
  );
};

// @ai-start
const styles = StyleSheet.create({
  content: {
    direction: appDirection,
    flexDirection: 'row',
    paddingHorizontal: moderateScale(8),
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(7),
  },
  iconBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  tabText: {
    fontSize: moderateScale(10, 0.2),
    marginTop: moderateScale(3),
  },
});
// @ai-end

export default BottomTabBar;
