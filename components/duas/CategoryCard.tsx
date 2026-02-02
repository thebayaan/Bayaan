import React from 'react';
import {TouchableOpacity, View, Text, StyleSheet} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {moderateScale} from 'react-native-size-matters';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {DuaCategory} from '@/types/dua';

interface CategoryCardProps {
  category: DuaCategory;
  tagColor: string;
  onPress: () => void;
  width?: number;
  height?: number;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  tagColor,
  onPress,
  width = moderateScale(160),
  height = moderateScale(100),
}) => {
  const {theme} = useTheme();

  // Create gradient colors from tagColor
  const gradientTop = Color(tagColor).alpha(0.8).toString();
  const gradientBottom = Color(tagColor).alpha(0.4).toString();

  const styles = StyleSheet.create({
    container: {
      width,
      height,
      borderRadius: moderateScale(12),
      overflow: 'hidden',
    },
    gradient: {
      flex: 1,
      padding: moderateScale(12),
      justifyContent: 'space-between',
    },
    countContainer: {
      alignSelf: 'flex-end',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingHorizontal: moderateScale(8),
      paddingVertical: moderateScale(4),
      borderRadius: moderateScale(8),
    },
    countText: {
      fontSize: moderateScale(11),
      fontFamily: theme.fonts.medium,
      color: 'rgba(255, 255, 255, 0.9)',
    },
    titleContainer: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    title: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: '#FFFFFF',
      lineHeight: moderateScale(18),
    },
  });

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <View style={styles.container}>
        <LinearGradient
          colors={[gradientTop, gradientBottom]}
          start={{x: 0, y: 0}}
          end={{x: 0, y: 1}}
          style={styles.gradient}>
          <View style={styles.countContainer}>
            <Text style={styles.countText}>
              {category.duaCount} {category.duaCount === 1 ? 'dua' : 'duas'}
            </Text>
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={2}>
              {category.title}
            </Text>
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
};
