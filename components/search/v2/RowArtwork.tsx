import {Image} from 'expo-image';
import {LinearGradient} from 'expo-linear-gradient';
import {StyleSheet, Text, View} from 'react-native';
import type {RankedResult} from '@/services/search/types';
import {ReciterImage} from '@/components/ReciterImage';
import {ADHKAR_CATEGORY_IMAGES} from '@/constants/adhkarImages';
import {loadAsma} from '@/services/search/adapters/names';

const ARTWORK_SIZE = 44;
const ASMA = loadAsma();

interface Props {
  result: RankedResult;
}

export function RowArtwork({result}: Props): JSX.Element {
  const payload = result.payload;

  if (payload.kind === 'reciter') {
    return (
      <ReciterImage
        imageUrl={payload.reciter.image_url ?? undefined}
        reciterName={payload.reciter.name}
        style={styles.reciterBox}
        profileIconSize={20}
      />
    );
  }

  if (payload.kind === 'adhkar_category') {
    const imageSet = ADHKAR_CATEGORY_IMAGES[payload.categoryId];
    if (imageSet?.dark) {
      return (
        <View style={styles.box}>
          <Image
            source={imageSet.dark}
            style={styles.fill}
            contentFit="cover"
            recyclingKey={`adhkar-${payload.categoryId}`}
            transition={100}
          />
        </View>
      );
    }
    return (
      <LinearGradient
        colors={['rgba(212,175,55,0.25)', 'rgba(212,175,55,0.05)']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={[styles.box, styles.center]}>
        <Text style={styles.fallbackLetter}>
          {result.artwork?.label ?? '?'}
        </Text>
      </LinearGradient>
    );
  }

  if (payload.kind === 'name_of_allah') {
    const entry = ASMA[payload.index - 1];
    const arabic = entry?.arabic ?? '';
    return (
      <View style={[styles.box, styles.center, styles.nameBox]}>
        <Text style={styles.nameArabic} numberOfLines={1} adjustsFontSizeToFit>
          {arabic}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.box, styles.center]}>
      <Text style={styles.label}>{result.artwork?.label ?? '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1c1c1e',
  },
  reciterBox: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: ARTWORK_SIZE / 2,
    overflow: 'hidden',
  },
  center: {alignItems: 'center', justifyContent: 'center'},
  nameBox: {
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.20)',
  },
  nameArabic: {
    fontFamily: 'ScheherazadeNew-SemiBold',
    color: '#d4af37',
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  fill: {width: '100%', height: '100%'},
  label: {color: '#d4af37', fontWeight: '700', fontSize: 14},
  fallbackLetter: {color: '#d4af37', fontWeight: '700', fontSize: 16},
});
