import React, {useMemo} from 'react';
import {View, StyleSheet, ViewStyle, StyleProp} from 'react-native';
import {Image} from 'expo-image';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {ProfileIcon} from '@/components/Icons';
import {reciterImages} from '@/utils/reciterImages';

interface ReciterImageProps {
  imageUrl?: string;
  reciterName: string;
  style?: StyleProp<ViewStyle>;
  profileIconSize?: number;
}

export const ReciterImage: React.FC<ReciterImageProps> = React.memo(
  ({reciterName = '', style, profileIconSize}) => {
    const {theme} = useTheme();

    const styles = useMemo(
      () =>
        StyleSheet.create({
          container: {
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
          squircleMask: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.colors.card,
            borderRadius: moderateScale(12),
          },
        }),
      [theme],
    );

    const formattedName = useMemo(() => {
      if (!reciterName) return '';
      return reciterName.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-');
    }, [reciterName]);

    const localImageSource = useMemo(() => {
      if (!formattedName) return null;
      return reciterImages[formattedName];
    }, [formattedName]);

    return (
      <View style={[styles.container, style]}>
        <View style={styles.squircleMask} />
        {localImageSource ? (
          <Image
            source={localImageSource}
            style={styles.image}
            contentFit="cover"
          />
        ) : (
          <ProfileIcon
            color={theme.colors.light}
            size={profileIconSize || moderateScale(20)}
          />
        )}
      </View>
    );
  },
);

ReciterImage.displayName = 'ReciterImage';
