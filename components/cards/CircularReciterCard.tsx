import React, {useMemo} from 'react';
import {
  Text,
  Pressable,
  View,
  StyleSheet,
  StyleProp,
  TextStyle,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {ReciterImage} from '@/components/ReciterImage';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {Link} from 'expo-router';
import {USE_GLASS} from '@/hooks/useGlassProps';

interface CircularReciterCardProps {
  imageUrl?: string;
  name: string;
  reciterId?: string;
  onPress: () => void;
  onLongPress?: () => void;
  size?: 'small' | 'medium' | 'large';
  isSelected?: boolean;
  variant?: 'default' | 'add';
  addTextStyle?: StyleProp<TextStyle>;
  width?: number;
  height?: number;
  showFollowAlong?: boolean;
}

export const CircularReciterCard: React.FC<CircularReciterCardProps> = ({
  imageUrl,
  name,
  reciterId,
  onPress,
  onLongPress,
  size = 'medium',
  isSelected = false,
  variant = 'default',
  addTextStyle,
  width,
  height,
}) => {
  const {theme} = useTheme();

  const sizeMap = {
    small: 50,
    medium: 64,
    large: 78,
  };

  const imageSize = width || sizeMap[size];
  const calculatedHeight = height || imageSize;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          alignItems: 'center',
          width: imageSize + moderateScale(6),
        },
        imageContainer: {
          width: imageSize,
          height: calculatedHeight,
          borderRadius: calculatedHeight / 2,
          overflow: 'hidden',
          marginBottom: verticalScale(5),
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: Color(theme.colors.text).alpha(0.06).toString(),
        },
        reciterImage: {
          width: '100%',
          height: '100%',
        },
        selectedOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: Color(theme.colors.text).alpha(0.25).toString(),
          justifyContent: 'center',
          alignItems: 'center',
        },
        name: {
          color: theme.colors.text,
          fontSize: moderateScale(10.5),
          fontFamily: 'Manrope-Medium',
          textAlign: 'center',
          width: imageSize + moderateScale(6),
        },
        subtitle: {
          fontSize: moderateScale(8.5),
          fontFamily: 'Manrope-Regular',
          color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
          textAlign: 'center',
          width: imageSize,
          marginTop: moderateScale(1),
        },
        addContainer: {
          width: imageSize,
          height: calculatedHeight,
          borderRadius: calculatedHeight / 2,
          overflow: 'hidden',
          marginBottom: verticalScale(5),
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
          borderWidth: 1.5,
          borderColor: Color(theme.colors.text).alpha(0.08).toString(),
          borderStyle: 'dashed',
        },
        addText: {
          fontSize: moderateScale(10.5),
          fontFamily: 'Manrope-SemiBold',
          color: Color(theme.colors.text).alpha(0.7).toString(),
          textAlign: 'center',
          width: imageSize,
          marginTop: verticalScale(2),
        },
      }),
    [theme, imageSize, calculatedHeight],
  );

  const useZoom = variant === 'default' && !!reciterId;

  const content = (
    <>
      <View
        style={variant === 'add' ? styles.addContainer : styles.imageContainer}>
        {variant === 'default' ? (
          <>
            <ReciterImage
              imageUrl={imageUrl}
              reciterName={name}
              style={styles.reciterImage}
            />
            {isSelected && <View style={styles.selectedOverlay} />}
          </>
        ) : (
          <Feather
            name="plus"
            size={moderateScale(imageSize * 0.3)}
            color={Color(theme.colors.text).alpha(0.3).toString()}
          />
        )}
      </View>
      {variant === 'add' ? (
        <Text style={[styles.addText, addTextStyle]} numberOfLines={2}>
          {name}
        </Text>
      ) : (
        <>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Reciter
          </Text>
        </>
      )}
    </>
  );

  if (useZoom) {
    const inner = USE_GLASS ? (
      <Link.AppleZoom>
        <View style={{flex: 1}}>{content}</View>
      </Link.AppleZoom>
    ) : (
      content
    );

    return (
      <Link
        href={{
          pathname: '/(tabs)/(a.home)/reciter/[id]',
          params: {id: reciterId},
        }}
        asChild>
        <Pressable onLongPress={onLongPress} style={styles.container}>
          {inner}
        </Pressable>
      </Link>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.container}>
      {content}
    </Pressable>
  );
};
