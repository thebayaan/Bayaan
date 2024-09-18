import React from 'react';
import {View, TouchableOpacity, Text, StyleSheet} from 'react-native';
import {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {Icon} from '@rneui/themed';
import {CommonActions} from '@react-navigation/native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {HomeIcon, SearchIcon, CollectionIcon} from '@/components/Icons';

const BottomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const {theme} = useTheme();
  const iconSize = moderateScale(28, 0.3);
  const insets = useSafeAreaInsets();
  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: theme.colors.card,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: -1,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 5,
    },
    content: {
      flexDirection: 'row',
      flex: 1,
      paddingBottom: insets.bottom,
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(10),
    },
    tabText: {
      fontSize: moderateScale(12),
      marginTop: moderateScale(4),
      color: theme.colors.text,
    },
  });

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

            if (route.name === 'Search') {
              navigation.setParams({focusSearchBar: true});
            }
          };

          const getIcon = () => {
            switch (route.name) {
              case 'index':
                return {
                  component: HomeIcon,
                  props: {
                    type: 'home' as const,
                    filled: isFocused,
                    color: isFocused
                      ? theme.colors.text
                      : theme.colors.textSecondary,
                    size: iconSize,
                  },
                };
              case 'search':
                return {
                  component: SearchIcon,
                  props: {
                    type: 'search' as const,
                    filled: isFocused,
                    color: isFocused
                      ? theme.colors.text
                      : theme.colors.textSecondary,
                    size: iconSize,
                  },
                };
              case 'collection':
                return {
                  component: CollectionIcon,
                  props: {
                    type: 'collection' as const,
                    filled: isFocused,
                    color: isFocused
                      ? theme.colors.text
                      : theme.colors.textSecondary,
                    size: iconSize,
                  },
                };
              default:
                return {
                  name: 'question',
                  type: 'font-awesome',
                  color: isFocused
                    ? theme.colors.primary
                    : theme.colors.textSecondary,
                };
            }
          };

          const iconConfig = getIcon();

          return (
            <TouchableOpacity
              key={index}
              onPress={onPress}
              style={styles.tabButton}>
              {iconConfig.component ? (
                <iconConfig.component {...iconConfig.props} />
              ) : (
                <Icon
                  name={iconConfig.name}
                  type={iconConfig.type}
                  color={iconConfig.color}
                  size={24}
                />
              )}
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
