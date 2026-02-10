import React from 'react';
import {
  NativeTabs,
  Icon,
  Label,
  VectorIcon,
} from 'expo-router/unstable-native-tabs';
import {StatusBar} from 'expo-status-bar';
import {useTheme} from '@/hooks/useTheme';
import {DynamicColorIOS, Platform} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function TabsLayout() {
  const {isDarkMode, theme} = useTheme();
  const liquidLabelColor =
    Platform.OS === 'ios'
      ? DynamicColorIOS({light: '#111111', dark: '#FFFFFF'})
      : theme.colors.textSecondary;
  const liquidTintColor =
    Platform.OS === 'ios'
      ? DynamicColorIOS({light: '#111111', dark: '#FFFFFF'})
      : theme.colors.text;

  return (
    <>
      <StatusBar
        style={isDarkMode ? 'light' : 'dark'}
        translucent
        backgroundColor="transparent"
      />
      <NativeTabs
        blurEffect="systemChromeMaterial"
        disableTransparentOnScrollEdge={false}
        backgroundColor={Platform.OS === 'ios' ? null : theme.colors.background}
        labelStyle={{color: liquidLabelColor}}
        tintColor={liquidTintColor}
        iconColor={{
          default: theme.colors.textSecondary,
          selected: theme.colors.text,
        }}>
        <NativeTabs.Trigger name="(a.home)">
          <Label>Home</Label>
          <Icon
            src={{
              default: (
                <VectorIcon
                  family={MaterialCommunityIcons}
                  name="home-outline"
                />
              ),
              selected: (
                <VectorIcon family={MaterialCommunityIcons} name="home" />
              ),
            }}
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="(b.search)" role="search">
          <Label>Search</Label>
          <Icon
            src={<VectorIcon family={MaterialCommunityIcons} name="magnify" />}
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="(c.collection)">
          <Label>Collection</Label>
          <Icon
            src={{
              default: (
                <VectorIcon
                  family={MaterialCommunityIcons}
                  name="view-grid-outline"
                />
              ),
              selected: (
                <VectorIcon family={MaterialCommunityIcons} name="view-grid" />
              ),
            }}
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="(d.mushaf)">
          <Label>Mushaf</Label>
          <Icon
            src={{
              default: (
                <VectorIcon
                  family={MaterialCommunityIcons}
                  name="book-open-page-variant"
                />
              ),
              selected: (
                <VectorIcon
                  family={MaterialCommunityIcons}
                  name="book-open-page-variant"
                />
              ),
            }}
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}
