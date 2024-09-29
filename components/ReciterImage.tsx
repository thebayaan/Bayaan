import React, {useMemo} from 'react';
import {View, StyleSheet, ViewStyle, StyleProp} from 'react-native';
import FastImage from 'react-native-fast-image';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {ProfileIcon} from '@/components/Icons';

interface ReciterImageProps {
  imageUrl?: string;
  style?: StyleProp<ViewStyle>;
}

export const ReciterImage: React.FC<ReciterImageProps> = React.memo(
  ({imageUrl, style}) => {
    const {theme} = useTheme();

    const styles = useMemo(
      () =>
        StyleSheet.create({
          container: {
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
      [theme],
    );

    return (
      <View style={[styles.container, style]}>
        {imageUrl ? (
          <FastImage
            source={{uri: imageUrl}}
            style={styles.image}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <ProfileIcon color={theme.colors.light} size={moderateScale(60)} />
        )}
      </View>
    );
  },
);

ReciterImage.displayName = 'ReciterImage';
