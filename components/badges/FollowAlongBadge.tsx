import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {moderateScale} from '@/utils/scale';
import {Ionicons} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import Color from 'color';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end

interface FollowAlongBadgeProps {
  size?: 'small' | 'default';
}

// @ai-start
export const FollowAlongBadge: React.FC<FollowAlongBadgeProps> = React.memo(
  ({size = 'default'}) => {
    const {theme} = useTheme();
    const {t} = useTranslation(['collection', 'common']);

    const backgroundColor = Color(theme.colors.text).alpha(0.06).toString();
    const iconColor = theme.colors.textSecondary;

    if (size === 'small') {
      return (
        <View style={[styles.smallContainer, {backgroundColor}]}>
          <Ionicons
            name="locate-outline"
            size={moderateScale(10)}
            color={iconColor}
          />
        </View>
      );
    }

    return (
      <View style={[styles.container, {backgroundColor}]}>
        <Ionicons
          name="locate-outline"
          size={moderateScale(9)}
          color={iconColor}
        />
        <Text
          style={[
            styles.label,
            {
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.medium,
            },
          ]}>
          {t('followAlongBadge')}
        </Text>
      </View>
    );
  },
);
// @ai-end

FollowAlongBadge.displayName = 'FollowAlongBadge';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(3),
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(2),
    borderRadius: moderateScale(6),
    alignSelf: 'flex-start',
  },
  smallContainer: {
    width: moderateScale(18),
    height: moderateScale(18),
    borderRadius: moderateScale(9),
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: moderateScale(8),
    lineHeight: moderateScale(12),
  },
});
