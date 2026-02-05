import React from 'react';
import {Text, Pressable, ScrollView, StyleSheet} from 'react-native';
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
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => onTabChange(tab.id)}>
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
              {tab.label}
            </Text>
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
      gap: moderateScale(8),
      paddingVertical: moderateScale(6),
    },
    pill: {
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(6),
      borderRadius: moderateScale(16),
      borderWidth: 1,
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    pillActive: {
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
      borderColor: Color(theme.colors.text).alpha(0.2).toString(),
    },
    pillText: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    pillTextActive: {
      color: theme.colors.text,
      fontFamily: 'Manrope-SemiBold',
    },
  });
