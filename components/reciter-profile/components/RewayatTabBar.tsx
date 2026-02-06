import React from 'react';
import {View, Text, Pressable, ScrollView, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import Color from 'color';
import {Theme} from '@/utils/themeUtils';

interface Tab {
  id: string;
  label: string;
}

interface RewayatTabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  theme: Theme;
}

export const RewayatTabBar: React.FC<RewayatTabBarProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  theme,
}) => {
  const styles = createStyles(theme);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}>
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        return (
          <Pressable
            key={tab.id}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onTabChange(tab.id)}>
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {isActive && <View style={styles.indicator} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: moderateScale(16),
      gap: moderateScale(4),
    },
    tab: {
      paddingHorizontal: moderateScale(12),
      paddingTop: moderateScale(10),
      paddingBottom: moderateScale(8),
      alignItems: 'center',
    },
    tabActive: {},
    tabText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    tabTextActive: {
      color: theme.colors.text,
      fontFamily: 'Manrope-Bold',
    },
    indicator: {
      height: moderateScale(2.5),
      borderRadius: moderateScale(2),
      backgroundColor: theme.colors.text,
      width: '80%',
      marginTop: moderateScale(6),
    },
  });
