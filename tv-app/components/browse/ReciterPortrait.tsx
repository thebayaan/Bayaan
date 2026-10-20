import React from 'react';
import {Image} from 'expo-image';
import {Text, View} from 'react-native';
import {SurahFill} from '../brand/SurahFill';
import {getReciterArtwork} from '../../services/reciterArtwork';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {scale} from '../../theme/scale';
import type {Reciter} from '../../types/reciter';
/** The reciter's Arabic name from the catalog. */
export function reciterArabicName(reciter: Reciter): string | null {
  return reciter.name_arabic || null;
}

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

type Props = {
  reciter: Reciter;
  /** Diameter in design pixels (the parent clips it round). */
  size: number;
  /** Gradient id prefix, unique per screen. */
  idPrefix: string;
};

/**
 * A reciter's portrait filling its (round, clipped) parent. Without artwork:
 * a pigment gradient with the first letter of the Arabic name (or the English
 * initial), so a missing photo still reads as a person, not a hole.
 */
export function ReciterPortrait({
  reciter,
  size,
  idPrefix,
}: Props): React.ReactElement {
  const artwork = getReciterArtwork(reciter);
  if (artwork) {
    return (
      <Image
        source={artwork}
        style={{width: '100%', height: '100%'}}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={150}
        accessible={false}
      />
    );
  }
  const arabic = reciterArabicName(reciter);
  const initial = arabic
    ? arabic.trim().charAt(0)
    : reciter.name.charAt(0).toUpperCase();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceElevated,
      }}>
      <SurahFill
        surahNumber={(hashString(reciter.id) % 114) + 1}
        id={`${idPrefix}-${reciter.id}`}
      />
      <Text
        style={{
          color: colors.text,
          fontFamily: arabic ? undefined : fonts.light,
          fontWeight: '300',
          fontSize: scale(size * 0.34),
          opacity: 0.9,
        }}>
        {initial}
      </Text>
    </View>
  );
}
