import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import {Theme} from '@/utils/themeUtils';

interface GridItemProps {
  title: string;
  subtitle: string;
  iconName?: string;
  iconType?: string;
  thumbnail?: string;
  onPress: () => void;
  theme: Theme;
  isLarge?: boolean; // For featured items
}

export const GridItem: React.FC<GridItemProps> = ({
  title,
  subtitle,
  iconName,
  iconType = 'feather',
  thumbnail,
  onPress,
  theme,
  isLarge = false,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        isLarge ? styles.largeCard : styles.smallCard,
        {backgroundColor: theme.colors.card}
      ]}
      onPress={onPress}
      activeOpacity={0.8}>
      
      {/* Icon Container */}
      <View style={[
        styles.iconContainer,
        isLarge ? styles.largeIconContainer : styles.smallIconContainer,
        {backgroundColor: theme.colors.primary}
      ]}>
        {iconName ? (
          <Icon
            name={iconName}
            type={iconType}
            size={moderateScale(isLarge ? 28 : 20)}
            color="white"
          />
        ) : thumbnail ? (
          <Text style={styles.thumbnailText}>{thumbnail}</Text>
        ) : (
          <Icon
            name="music"
            type="feather"
            size={moderateScale(isLarge ? 28 : 20)}
            color="white"
          />
        )}
      </View>
      
      {/* Content */}
      <View style={styles.content}>
        <Text style={[
          styles.title, 
          {color: theme.colors.text},
          isLarge ? styles.largeTitle : styles.smallTitle
        ]} numberOfLines={isLarge ? 1 : 2}>
          {title}
        </Text>
        <Text style={[
          styles.subtitle, 
          {color: theme.colors.textSecondary},
          isLarge ? styles.largeSubtitle : styles.smallSubtitle
        ]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    marginBottom: moderateScale(12),
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  largeCard: {
    width: '100%',
    height: moderateScale(120),
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallCard: {
    width: '48%',
    height: moderateScale(140),
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    borderRadius: moderateScale(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeIconContainer: {
    width: moderateScale(64),
    height: moderateScale(64),
    marginRight: moderateScale(16),
  },
  smallIconContainer: {
    width: moderateScale(48),
    height: moderateScale(48),
    marginBottom: moderateScale(12),
  },
  thumbnailText: {
    fontSize: moderateScale(20),
    color: 'white',
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: moderateScale(4),
  },
  largeTitle: {
    fontSize: moderateScale(20),
    textAlign: 'left',
  },
  smallTitle: {
    fontSize: moderateScale(14),
  },
  subtitle: {
    fontWeight: '400',
    textAlign: 'center',
  },
  largeSubtitle: {
    fontSize: moderateScale(14),
    textAlign: 'left',
  },
  smallSubtitle: {
    fontSize: moderateScale(12),
  },
});
