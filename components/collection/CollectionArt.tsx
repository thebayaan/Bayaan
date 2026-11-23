// @ai-generated
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {ReciterImage} from '@/components/ReciterImage';
import {
  DownloadIcon,
  HeartIcon,
  MicrophoneIcon,
  PlaylistIcon,
  ProfileIcon,
} from '@/components/Icons';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {localizeDigits} from '@/i18n/format';
import {
  SurahGradientMesh,
  paletteForSurah,
} from '@/components/hero/SurahGradientMesh';

/**
 * Artwork for the Collection tab and the screens behind it. A category
 * shows a piece of what's inside (a surah cover, a playlist mosaic, the
 * newest verse number…) and falls back to a glass icon when it's empty.
 */

export type CollectionCategoryId =
  | 'loved'
  | 'playlists'
  | 'downloads'
  | 'bookmarks'
  | 'notes'
  | 'reciters'
  | 'uploads';

export const CATEGORY_COLORS: Record<CollectionCategoryId, string> = {
  loved: '#FF6B6B',
  playlists: '#6366F1',
  downloads: '#10AC84',
  bookmarks: '#F59E0B',
  notes: '#3B82F6',
  reciters: '#EC4899',
  uploads: '#8B5CF6',
};

/**
 * A surah's tile in the Surahs tab style: its gradient mesh (the same
 * palette the Surahs cards and hero use) under the name glyph. Drawn on
 * the device, so it works offline and follows the theme.
 */
function SurahMeshTile({
  surahId,
  width,
  height,
  glyph,
  style,
}: {
  surahId: number | null;
  width: number;
  height: number;
  glyph: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const {theme} = useTheme();
  // Small tiles get stronger colour so they still read as distinct.
  // Light mode needs more, the pastel palettes wash out on a light panel.
  const boost = theme.isDarkMode ? 1 : 1.6;
  const intensity =
    boost * Math.min(4, Math.max(1.4, 160 / Math.max(width, 1)));
  return (
    <View
      style={[
        {
          width,
          height,
          backgroundColor: Color(theme.colors.text)
            .alpha(theme.isDarkMode ? 0.06 : 0.035)
            .string(),
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderCurve: 'continuous',
          paddingHorizontal: width * 0.08,
        },
        style,
      ]}>
      {surahId !== null ? (
        <SurahGradientMesh
          palette={paletteForSurah(surahId)}
          isDark={theme.isDarkMode}
          viewBoxWidth={120}
          viewBoxHeight={120}
          intensity={intensity}
        />
      ) : null}
      {glyph && surahId !== null ? (
        <Text
          style={{
            fontFamily: 'SurahNames',
            fontSize: width * 0.3,
            color: theme.colors.text,
            width: '100%',
            textAlign: 'center',
            textShadowColor: 'rgba(0, 0, 0, 0.1)',
            textShadowOffset: {width: 0, height: 1},
            textShadowRadius: 2,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.4}>
          {surahGlyphMap[surahId] ?? ''}
        </Text>
      ) : null}
    </View>
  );
}

/** A surah's cover: the Surahs tab card's mesh and name glyph. */
export function SurahCover({
  surahId,
  size,
  radius,
  style,
}: {
  surahId: number;
  size: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SurahMeshTile
      surahId={surahId}
      width={size}
      height={size}
      glyph
      style={[
        {
          borderRadius: radius ?? Math.round(size * 0.24),
        },
        style,
      ]}
    />
  );
}

/** Four surahs in a square, for a playlist. One surah shows alone. */
export function SurahMosaic({
  surahIds,
  size,
  radius,
}: {
  surahIds: number[];
  size: number;
  radius?: number;
}) {
  const r = radius ?? Math.round(size * 0.2);
  // Below 80pt four squares are too small for glyphs and read as blurs,
  // so a small mosaic shows its first surah's cover instead.
  if (surahIds.length <= 1 || size < 80) {
    return <SurahCover surahId={surahIds[0] ?? 1} size={size} radius={r} />;
  }
  // Two surahs sit on a diagonal; with three, the last square stays empty
  // instead of repeating the first surah.
  const ids: Array<number | null> =
    surahIds.length === 2
      ? [surahIds[0], surahIds[1], surahIds[1], surahIds[0]]
      : [0, 1, 2, 3].map(i => surahIds[i] ?? null);
  // A hairline between the four squares keeps them apart.
  const gap = Math.max(1, Math.round(size * 0.025));
  const half = Math.floor((size - gap) / 2);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        overflow: 'hidden',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignContent: 'space-between',
      }}>
      {ids.map((id, i) => (
        <SurahMeshTile key={i} surahId={id} width={half} height={half} glyph />
      ))}
    </View>
  );
}

function CategoryGlyph({
  category,
  color,
  size,
}: {
  category: CollectionCategoryId;
  color: string;
  size: number;
}) {
  switch (category) {
    case 'loved':
      return <HeartIcon color={color} size={size} filled />;
    case 'playlists':
      return <PlaylistIcon color={color} size={size} />;
    case 'downloads':
      return <DownloadIcon color={color} size={size} />;
    case 'bookmarks':
      return <Feather name="bookmark" color={color} size={size} />;
    case 'notes':
      return <Feather name="file-text" color={color} size={size} />;
    case 'reciters':
      return <ProfileIcon color={color} size={size} filled />;
    case 'uploads':
      return <MicrophoneIcon color={color} size={size} />;
  }
}

/** White icon on a soft gradient of the category colour. */
export function GlassIcon({
  category,
  size,
}: {
  category: CollectionCategoryId;
  size: number;
}) {
  const color = CATEGORY_COLORS[category];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        // A solid fill under the gradient lets iOS draw the shadow cheaply.
        backgroundColor: color,
        shadowColor: color,
        shadowOpacity: 0.45,
        shadowRadius: size * 0.12,
        shadowOffset: {width: 0, height: size * 0.06},
      }}>
      <LinearGradient
        colors={[Color(color).lighten(0.25).string(), color]}
        start={{x: 0.2, y: 0}}
        end={{x: 0.6, y: 1}}
        style={{
          flex: 1,
          borderRadius: Math.round(size * 0.3),
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <CategoryGlyph category={category} color="#FFFFFF" size={size * 0.5} />
      </LinearGradient>
    </View>
  );
}

/** What a category's preview shows; null falls back to the glass icon. */
export type CollectionPreviewData =
  | {kind: 'cover'; surahId: number; badge?: 'download' | 'upload'}
  | {kind: 'mosaic'; surahIds: number[]}
  | {kind: 'verse'; surahNumber: number; ayahNumber: number}
  | {kind: 'note'}
  | {
      kind: 'faces';
      reciters: Array<{id: string; name: string; image_url?: string | null}>;
    }
  | {kind: 'wave'}
  | null;

const WAVE = [0.3, 0.62, 0.9, 0.5, 0.74, 0.36];

export function CollectionPreview({
  category,
  data,
  size,
}: {
  category: CollectionCategoryId;
  data: CollectionPreviewData;
  size: number;
}) {
  const {theme} = useTheme();
  const color = CATEGORY_COLORS[category];
  const radius = Math.round(size * 0.25);
  if (!data) return <GlassIcon category={category} size={size} />;

  switch (data.kind) {
    case 'cover':
      return (
        <View style={{width: size, height: size}}>
          <SurahCover surahId={data.surahId} size={size} radius={radius} />
          {data.badge ? (
            <View
              style={{
                position: 'absolute',
                end: -size * 0.08,
                bottom: -size * 0.08,
                width: size * 0.44,
                height: size * 0.44,
                borderRadius: size * 0.22,
                backgroundColor: color,
                borderWidth: 2,
                borderColor: theme.colors.background,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {data.badge === 'upload' ? (
                <Feather name="arrow-up" color="#FFFFFF" size={size * 0.26} />
              ) : (
                <DownloadIcon color="#FFFFFF" size={size * 0.24} />
              )}
            </View>
          ) : null}
        </View>
      );
    case 'mosaic':
      return (
        <SurahMosaic surahIds={data.surahIds} size={size} radius={radius} />
      );
    case 'verse':
      return (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: Color(color).alpha(0.16).string(),
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text
            style={{
              fontFamily: theme.fonts.bold,
              fontSize: size * 0.2,
              lineHeight: size * 0.24,
              color: Color(color)
                .darken(theme.isDarkMode ? 0 : 0.35)
                .string(),
              opacity: 0.75,
            }}>
            {localizeDigits(`${data.surahNumber}:`)}
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.extraBold,
              fontSize: size * 0.3,
              lineHeight: size * 0.34,
              color: Color(color)
                .darken(theme.isDarkMode ? 0 : 0.35)
                .string(),
            }}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {localizeDigits(String(data.ayahNumber))}
          </Text>
        </View>
      );
    case 'note':
      return (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: theme.isDarkMode
              ? '#1E2A2F'
              : Color(theme.colors.text).alpha(0.05).string(),
            paddingHorizontal: size * 0.17,
            paddingTop: size * 0.12,
            gap: size * 0.08,
          }}>
          <Text
            style={{
              fontFamily: theme.fonts.extraBold,
              fontSize: size * 0.55,
              // A line as tall as the font keeps the mark from being clipped;
              // the negative margin pulls the lines back up under it.
              lineHeight: size * 0.55,
              marginBottom: -size * 0.24,
              color,
            }}>
            “
          </Text>
          <View
            style={{
              height: 2,
              width: '90%',
              borderRadius: 1,
              backgroundColor: Color(theme.colors.text).alpha(0.3).string(),
            }}
          />
          <View
            style={{
              height: 2,
              width: '60%',
              borderRadius: 1,
              backgroundColor: Color(theme.colors.text).alpha(0.3).string(),
            }}
          />
        </View>
      );
    case 'faces': {
      const face = size * 0.68;
      const [a, b] = data.reciters;
      const img = (r: NonNullable<typeof a>) => (
        <ReciterImage
          imageUrl={r.image_url ?? undefined}
          reciterName={r.name}
          style={{width: '100%', height: '100%'}}
          profileIconSize={face * 0.45}
        />
      );
      if (!b) {
        return (
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              overflow: 'hidden',
            }}>
            {img(a)}
          </View>
        );
      }
      const ring = {
        position: 'absolute' as const,
        width: face,
        height: face,
        borderRadius: face / 2,
        // A hairline in the background colour just separates the two
        // faces where they overlap.
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.background,
        overflow: 'hidden' as const,
      };
      return (
        <View style={{width: size, height: size}}>
          <View style={[ring, {top: 0, start: 0}]}>{img(a)}</View>
          <View style={[ring, {bottom: 0, end: 0}]}>{img(b)}</View>
        </View>
      );
    }
    case 'wave':
      return (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: Color(color).alpha(0.15).string(),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: size * 0.055,
          }}>
          {WAVE.map((h, i) => (
            <View
              key={i}
              style={{
                width: size * 0.07,
                height: size * 0.6 * h,
                borderRadius: size * 0.04,
                backgroundColor: color,
              }}
            />
          ))}
        </View>
      );
  }
}
