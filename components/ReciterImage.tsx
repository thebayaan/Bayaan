import React, {useMemo} from 'react';
import {View, StyleSheet, ViewStyle, StyleProp, Image} from 'react-native';
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
  ({reciterName, style}) => {
    const {theme} = useTheme();

    const styles = useMemo(
      () =>
        StyleSheet.create({
          container: {
            borderRadius: moderateScale(20),
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
      const formatted = reciterName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      return formatted;
    }, [reciterName]);

    const localImageSource = useMemo(() => {
      const source = reciterImages[formattedName];
      return source;
    }, [formattedName]);

    return (
      <View style={[styles.container, style]}>
        {localImageSource ? (
          <Image
            source={localImageSource}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <ProfileIcon color={theme.colors.light} size={moderateScale(60)} />
        )}
      </View>
    );
  },
);

ReciterImage.displayName = 'ReciterImage';
