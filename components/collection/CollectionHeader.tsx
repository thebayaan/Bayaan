import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';

interface CollectionHeaderProps {
  title: string;
  theme: Theme;
}

export const CollectionHeader: React.FC<CollectionHeaderProps> = ({
  title,
  theme,
}) => {
  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <Text style={[styles.title, {color: theme.colors.text}]}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(16),
  },
  title: {
    fontSize: moderateScale(28),
    fontWeight: 'bold',
  },
});
