import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Image} from 'expo-image';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {GradientFill} from '../brand/GradientFill';
import {FocusableCard} from '../primitives/FocusableCard';
import {adhkarImageUrl, type AdhkarList} from '../../services/adhkarData';
import {listGradient, listSubtitle} from '../../services/adhkarBrowse';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles, scale} from '../../theme/scale';
import {arabicFontStyle} from './arabicFont';

type Props = {
  list: AdhkarList;
  /** Big gradient card (the main lists) or a small one (the rest). */
  size: 'big' | 'small';
  /** Card width in design px. */
  width: number;
  /** The list fits the time of day: a sky NOW badge. */
  now?: boolean;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
};

export const BIG_CARD_HEIGHT = 240;
export const SMALL_CARD_HEIGHT = 132;

/** A vertical or horizontal ink scrim over artwork, so text stays legible. */
function Scrim({
  id,
  direction,
  from,
  to,
  color = colors.background,
}: {
  id: string;
  direction: 'up' | 'left';
  from: number;
  to: number;
  color?: string;
}): React.ReactElement {
  const coords =
    direction === 'up'
      ? {x1: '0', y1: '1', x2: '0', y2: '0'}
      : {x1: '0', y1: '0', x2: '1', y2: '0'};
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      pointerEvents="none">
      <Defs>
        <LinearGradient id={id} {...coords}>
          <Stop offset="0" stopColor={color} stopOpacity={from} />
          <Stop offset="1" stopColor={color} stopOpacity={to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * An adhkar list as a card: the list's colour as a gradient with its Arabic
 * title (complete on its own), the illustration from the CDN over it when it
 * loads, and the English title with its count.
 */
export function AdhkarListCard({
  list,
  size,
  width,
  now = false,
  onPress,
  hasTVPreferredFocus,
}: Props): React.ReactElement {
  const big = size === 'big';
  const height = big ? BIG_CARD_HEIGHT : SMALL_CARD_HEIGHT;
  const subtitle = listSubtitle(list.id, big);
  return (
    <FocusableCard
      onPress={onPress}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={`${list.title}, ${subtitle}${now ? ', now' : ''}`}
      style={{width: scale(width), height: scale(height)}}>
      {big ? (
        <View style={styles.fill}>
          <GradientFill
            colors={listGradient(list.color)}
            id={`adhkar-big-${list.id}`}
          />
          <Image
            source={{uri: adhkarImageUrl(list.id)}}
            style={[StyleSheet.absoluteFill, styles.bigImage]}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={250}
            accessible={false}
          />
          <Scrim
            id={`adhkar-scrim-${list.id}`}
            direction="up"
            from={0.85}
            to={0}
          />
          <Text style={[styles.bigArabic, arabicFontStyle]} numberOfLines={1}>
            {list.arabicTitle}
          </Text>
          {now ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>NOW</Text>
            </View>
          ) : null}
          <View style={styles.bigText}>
            <Text style={styles.bigTitle} numberOfLines={1}>
              {list.title}
            </Text>
            <Text style={styles.bigSub} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.fill, styles.smallFill]}>
          <View style={styles.smallArt}>
            <GradientFill
              colors={listGradient(list.color)}
              id={`adhkar-small-${list.id}`}
            />
            <Image
              source={{uri: adhkarImageUrl(list.id)}}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={250}
              accessible={false}
            />
            <Scrim
              id={`adhkar-fade-${list.id}`}
              direction="left"
              from={1}
              to={0.1}
              color={colors.surfaceElevated}
            />
          </View>
          <View style={styles.smallText}>
            <Text style={styles.smallTitle} numberOfLines={1}>
              {list.title}
            </Text>
            <Text style={styles.smallSub} numberOfLines={1}>
              {now ? <Text style={styles.smallNow}>NOW · </Text> : null}
              {subtitle}
            </Text>
          </View>
        </View>
      )}
    </FocusableCard>
  );
}

const styles = createScaledStyles({
  fill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    overflow: 'hidden',
  },
  bigImage: {opacity: 0.8},
  bigArabic: {
    position: 'absolute',
    top: 18,
    right: 26,
    left: 110,
    textAlign: 'right',
    color: colors.text,
    fontSize: 46,
    lineHeight: 84,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 12,
  },
  badge: {
    position: 'absolute',
    top: 24,
    left: 24,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    color: colors.accentInk,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1.6,
  },
  bigText: {position: 'absolute', left: 26, right: 26, bottom: 22},
  bigTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 32,
  },
  bigSub: {
    marginTop: 4,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 20,
  },
  smallFill: {backgroundColor: colors.surfaceElevated},
  smallArt: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '46%',
    opacity: 0.75,
  },
  smallText: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 26,
    paddingRight: 120,
  },
  smallTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 25,
  },
  smallSub: {
    marginTop: 4,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 19,
  },
  smallNow: {color: colors.accent, fontFamily: fonts.bold, fontWeight: '700'},
});
