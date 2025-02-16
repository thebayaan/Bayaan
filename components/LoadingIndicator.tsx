import React from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {PulseIndicator} from 'react-native-indicators';

interface LoadingIndicatorProps {
  variant?: 'default' | 'pulse';
  color?: string;
  size?: number;
  fullscreen?: boolean;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  variant = 'default',
  color,
  size,
  fullscreen = false,
}) => {
  const {theme} = useTheme();
  const indicatorColor = color || 'gray';
  const indicatorSize = size || moderateScale(30);

  const containerStyle = [
    createStyles().container,
    fullscreen && {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
  ];

  const renderIndicator = () => {
    switch (variant) {
      case 'pulse':
        return (
          <PulseIndicator
            color={indicatorColor}
            size={indicatorSize}
            animationDuration={1500}
          />
        );
      default:
        return (
          <ActivityIndicator size={indicatorSize} color={indicatorColor} />
        );
    }
  };

  return <View style={containerStyle}>{renderIndicator()}</View>;
};

export const createStyles = () =>
  ScaledSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: moderateScale(40),
      minHeight: moderateScale(40),
      // backgroundColor: theme.colors.background,
    },
  });
