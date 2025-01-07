import React, {useMemo} from 'react';
import {View, StyleSheet, ViewStyle, StyleProp, Image} from 'react-native';
import FastImage from 'react-native-fast-image';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {ProfileIcon} from '@/components/Icons';
import {reciterImages} from '@/utils/reciterImages';

interface ReciterImageProps {
  imageUrl?: string;
  reciterName: string;
  style?: StyleProp<ViewStyle>;
}

export const ReciterImage: React.FC<ReciterImageProps> = React.memo(
  ({imageUrl, reciterName, style}) => {
    const {theme} = useTheme();

    const styles = useMemo(
      () =>
        StyleSheet.create({
          container: {
            borderRadius: moderateScale(10),
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

    const formattedName = useMemo(() => {
      return reciterName.toLowerCase().replace(/\s+/g, '-');
    }, [reciterName]);

    const localImageSource = useMemo(() => {
      return reciterImages[formattedName];
    }, [formattedName]);

    const remoteImageUrl = useMemo(() => {
      return imageUrl
        ? imageUrl.replace(reciterName, formattedName)
        : undefined;
    }, [imageUrl, formattedName, reciterName]);

    return (
      <View style={[styles.container, style]}>
        {localImageSource ? (
          <Image
            source={localImageSource}
            style={styles.image}
            resizeMode="cover"
          />
        ) : remoteImageUrl ? (
          <FastImage
            source={{uri: remoteImageUrl}}
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
