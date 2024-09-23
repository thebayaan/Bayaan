import React, {useMemo} from 'react';
import {View, StyleSheet} from 'react-native';
import FastImage from 'react-native-fast-image';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {ProfileIcon} from '@/components/Icons';

interface ReciterImageProps {
  imageUrl?: string;
  width?: number;
  height?: number;
}

export const ReciterImage: React.FC<ReciterImageProps> = React.memo(
  ({imageUrl, width = 120, height = 120}) => {
    const {theme} = useTheme();

    const styles = useMemo(
      () =>
        StyleSheet.create({
          container: {
            width: moderateScale(width),
            height: moderateScale(height),
            borderRadius: moderateScale(4),
            // borderWidth: moderateScale(0.4),
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.card,
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
          },
          image: {
            width: '100%',
            height: '100%',
          },
        }),
      [width, height, theme],
    );

    return (
      <View style={styles.container}>
        {imageUrl ? (
          <FastImage
            source={{uri: imageUrl}}
            style={styles.image}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <ProfileIcon
            color={theme.colors.light}
            size={moderateScale(Math.min(width, height) * 0.625)}
          />
        )}
      </View>
    );
  },
);

ReciterImage.displayName = 'ReciterImage';
