import React from 'react';
import {View, TouchableOpacity, Text, StyleSheet, Platform} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {HomeIcon, SearchIcon, CollectionIcon} from '@/components/Icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CommonActions} from '@react-navigation/native';
import {BottomTabBarProps} from '@react-navigation/bottom-tabs';

const BottomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const iconSize = moderateScale(26, 0.2);
  const tabTextSize = moderateScale(10, 0.2);

  // Only apply bottom padding on iOS
  const bottomPadding = Platform.OS === 'ios' ? insets.bottom : 0;

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: theme.colors.background,
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
      fontSize: tabTextSize,
      marginTop: moderateScale(4),
      color: theme.colors.text,
    },
  });

  const getIcon = (routeName: string, isFocused: boolean) => {
    switch (routeName) {
      case '(home)':
        return (
          <HomeIcon
            filled={isFocused}
            color={isFocused ? theme.colors.text : theme.colors.textSecondary}
            size={iconSize}
          />
        );
      case '(search)':
        return (
          <SearchIcon
            filled={isFocused}
            color={isFocused ? theme.colors.text : theme.colors.textSecondary}
            size={iconSize}
          />
        );
      case '(collection)':
        return (
          <CollectionIcon
            filled={isFocused}
            color={isFocused ? theme.colors.text : theme.colors.textSecondary}
            size={iconSize}
          />
        );
      default:
        return null;
    }
  };

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

          const onPress = () => {
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
          };

          return (
            <TouchableOpacity
              activeOpacity={0.99}
              key={index}
              onPress={onPress}
              style={styles.tabButton}>
              {getIcon(route.name, isFocused)}
              <Text style={styles.tabText}>
                {typeof label === 'string' ? label : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default BottomTabBar;
