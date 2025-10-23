import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import {Theme} from '@/utils/themeUtils';

interface CollectionItemProps {
  title: string;
  subtitle: string;
  iconName?: string;
  iconType?: string;
  thumbnail?: string;
  onPress: () => void;
  theme: Theme;
}

export const CollectionItem: React.FC<CollectionItemProps> = ({
  title,
  subtitle,
  iconName,
  iconType = 'feather',
  thumbnail,
  onPress,
  theme,
}) => {
  return (
    <TouchableOpacity
      style={[styles.container, {backgroundColor: theme.colors.background}]}
      onPress={onPress}
      activeOpacity={0.7}>
      
      {/* Thumbnail/Icon */}
      <View style={[styles.thumbnail, {backgroundColor: theme.colors.card}]}>
        {iconName ? (
          <Icon
            name={iconName}
            type={iconType}
            size={moderateScale(24)}
            color={theme.colors.primary}
          />
        ) : thumbnail ? (
          <Text style={styles.thumbnailText}>{thumbnail}</Text>
        ) : (
          <Icon
            name="music"
            type="feather"
            size={moderateScale(24)}
            color={theme.colors.primary}
          />
        )}
      </View>
      
      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.title, {color: theme.colors.text}]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.subtitle, {color: theme.colors.textSecondary}]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(16),
    paddingHorizontal: moderateScale(20),
    marginHorizontal: moderateScale(16),
    marginVertical: moderateScale(4),
    borderRadius: moderateScale(12),
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  thumbnail: {
    width: moderateScale(52),
    height: moderateScale(52),
    borderRadius: moderateScale(12),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(16),
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbnailText: {
    fontSize: moderateScale(20),
    color: 'white',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    marginBottom: moderateScale(2),
  },
  subtitle: {
    fontSize: moderateScale(14),
    fontWeight: '400',
  },
});
