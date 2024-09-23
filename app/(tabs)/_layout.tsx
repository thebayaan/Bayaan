/* eslint-disable react/no-unstable-nested-components */
import React from 'react';
import {Tabs} from 'expo-router';
import {View, TouchableOpacity, Text, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {HomeIcon, SearchIcon, CollectionIcon} from '@/components/Icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CommonActions} from '@react-navigation/native';

export default function TabsLayout() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const iconSize = moderateScale(28, 0.2);
  const tabTextSize = moderateScale(12, 0.2);

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
      paddingBottom: insets.bottom,
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
    },
    tabText: {
      fontSize: tabTextSize,
      marginTop: moderateScale(4),
      color: theme.colors.text,
    },
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={({state, descriptors, navigation}) => (
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
                    return null;
                }
              };

              const iconConfig = getIcon();

              return (
                <TouchableOpacity
                  key={index}
                  onPress={onPress}
                  style={styles.tabButton}>
                  {iconConfig && <iconConfig.component {...iconConfig.props} />}
                  <Text style={styles.tabText}>
                    {typeof label === 'string' ? label : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}>
      <Tabs.Screen name="index" options={{title: 'Home'}} />
      <Tabs.Screen name="search" options={{title: 'Search'}} />
      <Tabs.Screen name="collection" options={{title: 'Your Collection'}} />
    </Tabs>
  );
}
