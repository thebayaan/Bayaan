// The adhkar session's artwork: the list's illustration (the same one
// AdhkarBentoCard shows), or a neutral bookmark tile for Saved and for any
// list without an illustration. The caller's style gives the tile its
// background.
import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import {Image, type ImageSource} from 'expo-image';
import {Ionicons} from '@expo/vector-icons';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {ADHKAR_CATEGORY_IMAGES} from '@/constants/adhkarImages';

export function adhkarSessionImage(
  listId: string,
  isDarkMode: boolean,
): ImageSource | null {
  const set = ADHKAR_CATEGORY_IMAGES[listId];
  if (!set) return null;
  return isDarkMode ? set.dark : set.light;
}

export function AdhkarSessionArtwork({
  listId,
  iconSize,
  style,
}: {
  listId: string;
  iconSize: number;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const {theme} = useTheme();
  const source = adhkarSessionImage(listId, theme.isDarkMode);

  if (source) {
    return (
      <View style={style}>
        <Image
          testID="adhkar-session-artwork-image"
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      </View>
    );
  }

  return (
    <View
      testID="adhkar-session-artwork-fallback"
      style={[style, styles.fallback]}>
      <Ionicons
        name="bookmark"
        size={iconSize}
        color={Color(theme.colors.text).alpha(0.35).toString()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {alignItems: 'center', justifyContent: 'center'},
});
