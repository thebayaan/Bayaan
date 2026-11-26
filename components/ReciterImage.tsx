import React, {useMemo, useState} from 'react'; // @ai
import {View, StyleSheet, ViewStyle, StyleProp} from 'react-native';
import {Image} from 'expo-image';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {ProfileIcon} from '@/components/Icons';
// @ai-start
import {
  getLocalReciterImage,
  reciterImageKey,
} from '@/utils/reciterImageLookup';
// @ai-end

interface ReciterImageProps {
  imageUrl?: string;
  reciterName: string;
  style?: StyleProp<ViewStyle>;
  profileIconSize?: number;
  blurRadius?: number;
}

export const ReciterImage: React.FC<ReciterImageProps> = React.memo(
  ({imageUrl, reciterName = '', style, profileIconSize, blurRadius}) => {
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

    // @ai-start
    const formattedName = useMemo(
      () => (reciterName ? reciterImageKey(reciterName) : ''),
      [reciterName],
    );

    const localImageSource = useMemo(
      () => getLocalReciterImage(reciterName) ?? null,
      [reciterName],
    );
    // @ai-end

    // @ai-start
    // A remote photo that cannot be loaded (offline and not cached, a dead
    // link) left a blank tile. Remember which URL failed and show the
    // bundled photo, or the icon, in its place. Kept per URL because list
    // cells are reused for other reciters.
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const remoteUrl = imageUrl && imageUrl !== failedUrl ? imageUrl : null;
    // @ai-end

    // Prefer the catalog-supplied `imageUrl` over the bundled local headshot.
    // Catalog entries with `image_url` should win so reciters without a bundled
    // asset still render their photo. Local stays as a fallback for reciters
    // whose catalog entry has no image_url.
    const imageSource = remoteUrl ? {uri: remoteUrl} : localImageSource; // @ai

    return (
      <View style={[styles.container, style]}>
        <View style={styles.squircleMask} />
        {imageSource ? (
          <Image
            source={imageSource}
            style={styles.image}
            contentFit="cover"
            recyclingKey={imageUrl || formattedName}
            transition={100}
            onError={remoteUrl ? () => setFailedUrl(remoteUrl) : undefined} // @ai
            {...(blurRadius ? {blurRadius} : {})}
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
