import React, {useCallback, useMemo} from 'react';
import {View, Pressable, Text, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {
  HomeIcon,
  SearchIcon,
  CollectionIcon,
  SettingsIcon,
} from '@/components/Icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CommonActions} from '@react-navigation/native';
import {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {
  FLOATING_UI_HORIZONTAL_MARGIN,
  FLOATING_TAB_BAR_BOTTOM_MARGIN,
} from '@/utils/constants';
import {GlassView} from 'expo-glass-effect';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {FrostedView} from '@/components/FrostedView';

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
    <Pressable onPress={onPress} style={styles.tabButton}>
      {getIcon(routeName, isFocused, theme, iconSize)}
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
  navigation,
}) => {
  const {theme} = useTheme();
  const glassColorScheme = useGlassColorScheme();
  const insets = useSafeAreaInsets();
  const iconSize = moderateScale(22, 0.2);

  const containerStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      bottom: insets.bottom + FLOATING_TAB_BAR_BOTTOM_MARGIN,
      left: FLOATING_UI_HORIZONTAL_MARGIN,
      right: FLOATING_UI_HORIZONTAL_MARGIN,
      borderRadius: moderateScale(100),
      overflow: 'hidden' as const,
      borderWidth: USE_GLASS ? 0 : 1,
      borderColor: USE_GLASS
        ? undefined
        : Color(theme.colors.text).alpha(0.1).toString(),
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 8,
    }),
    [theme.colors.text, insets.bottom],
  );

  const handleTabPress = useCallback(
    (route: (typeof state.routes)[number], index: number) => {
      const isFocused = state.index === index;
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.dispatch(
          CommonActions.navigate({name: route.name, merge: true}),
        );
      }
    },
    [state.index, navigation],
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

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    paddingHorizontal: moderateScale(8),
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(7),
  },
  tabText: {
    fontSize: moderateScale(10, 0.2),
    marginTop: moderateScale(3),
  },
});

export default BottomTabBar;
