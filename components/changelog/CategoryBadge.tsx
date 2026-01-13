import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {ChangeCategory} from '@/types/changelog';
import {moderateScale} from 'react-native-size-matters';
import Color from 'color';

interface CategoryBadgeProps {
  category: ChangeCategory;
  icon: string;
  label: string;
  color: string;
  isDark?: boolean;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  category,
  icon,
  label,
  color,
  isDark = false,
}) => {
  const backgroundColor = isDark
    ? Color(color).alpha(0.2).toString()
    : Color(color).alpha(0.15).toString();

  return (
    <View style={[styles.container, {backgroundColor}]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.label, {color}]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(12),
    alignSelf: 'flex-start',
  },
  icon: {
    fontSize: moderateScale(12),
    marginRight: moderateScale(4),
  },
  label: {
    fontSize: moderateScale(11),
    fontWeight: '600',
  },
});
