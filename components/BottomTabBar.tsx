import React, {useCallback, useMemo} from 'react';
import {View, Pressable, Text, StyleSheet, Platform} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {HomeIcon, SearchIcon, CollectionIcon, MushafiIcon} from '@/components/Icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CommonActions} from '@react-navigation/native';
import {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {Theme} from '@/utils/themeUtils';

function createStyles(
  backgroundColor: string,
  textColor: string,
  bottomPadding: number,
) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor,
      paddingBottom: bottomPadding,
    },
    content: {
      flexDirection: 'row',
      flex: 1,
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: moderateScale(10),
      paddingBottom:
        Platform.OS === 'android' ? moderateScale(10) : moderateScale(5),
    },
    tabText: {
      fontSize: moderateScale(10, 0.2),
      marginTop: moderateScale(4),
      color: textColor,
    },
  });
}

function getIcon(
  routeName: string,
  isFocused: boolean,
  theme: Theme,
  iconSize: number,
) {
  switch (routeName) {
    case '(a.home)':
      return (
        <HomeIcon
          filled={isFocused}
          color={isFocused ? theme.colors.text : theme.colors.textSecondary}
          size={iconSize}
        />
      );
    case '(b.search)':
      return (
        <SearchIcon
          filled={isFocused}
          color={isFocused ? theme.colors.text : theme.colors.textSecondary}
          size={iconSize}
        />
      );
    case '(c.collection)':
      return (
        <CollectionIcon
          filled={isFocused}
          color={isFocused ? theme.colors.text : theme.colors.textSecondary}
          size={iconSize}
        />
      );
    case '(d.mushaf)':
      return (
        <MushafiIcon
          color={isFocused ? theme.colors.text : theme.colors.textSecondary}
          size={iconSize}
        />
      );
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
  tabButtonStyle: object;
  tabTextStyle: object;
}

const TabItem = React.memo(function TabItem({
  routeName,
  label,
  isFocused,
  onPress,
  theme,
  iconSize,
  tabButtonStyle,
  tabTextStyle,
}: TabItemProps) {
  return (
    <Pressable onPress={onPress} style={tabButtonStyle}>
      {getIcon(routeName, isFocused, theme, iconSize)}
      <Text style={tabTextStyle}>{label}</Text>
    </Pressable>
  );
});

const BottomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const iconSize = moderateScale(26, 0.2);

  const bottomPadding = insets.bottom;

  const styles = useMemo(
    () =>
      createStyles(theme.colors.background, theme.colors.text, bottomPadding),
    [theme.colors.background, theme.colors.text, bottomPadding],
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

      if (route.name === 'search') {
        navigation.setParams({focusSearchBar: true});
      }
    },
    [state.index, navigation],
  );

  return (
    <View style={styles.container}>
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
              tabButtonStyle={styles.tabButton}
              tabTextStyle={styles.tabText}
            />
          );
        })}
      </View>
    </View>
  );
};

export default BottomTabBar;
