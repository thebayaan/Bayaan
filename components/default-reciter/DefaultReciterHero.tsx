// @ai-generated
import React, {useMemo} from 'react';
import {View, Text, Pressable, ScrollView, StyleSheet} from 'react-native';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {Feather} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {moderateScale} from '@/utils/scale';
import type {Reciter, Rewayat} from '@/data/reciterData';
import {ReciterImage} from '@/components/ReciterImage';
import {getReciterDisplayName} from '@/i18n/format';

// Fixed bar heights for the preview's waveform; the fill shows progress.
const WAVE = [
  5, 9, 14, 20, 12, 7, 16, 22, 18, 10, 6, 13, 20, 24, 16, 9, 5, 11, 18, 22, 14,
  8, 5, 10, 16, 20, 12, 7, 10, 5,
];

interface Props {
  reciter: Reciter;
  rewayat: Rewayat[];
  labels: string[];
  selectedRewayatId: string;
  onSelectRewayat: (rewayatId: string) => void;
  isPlaying: boolean;
  progress: number;
  onTogglePreview: () => void;
  artworkSize: number;
}

export function DefaultReciterHero({
  reciter,
  rewayat,
  labels,
  selectedRewayatId,
  onSelectRewayat,
  isPlaying,
  progress,
  onTogglePreview,
  artworkSize,
}: Props) {
  const {theme} = useTheme();
  const {t} = useTranslation('settings');
  const styles = useMemo(
    () => createStyles(theme, artworkSize),
    [theme, artworkSize],
  );
  const selectedIndex = Math.max(
    0,
    rewayat.findIndex(r => r.id === selectedRewayatId),
  );
  const filled = isPlaying ? Math.round(progress * WAVE.length) : 0;
  const name = getReciterDisplayName(reciter);

  return (
    <View style={styles.container}>
      <View style={styles.glow} pointerEvents="none">
        <ReciterImage
          imageUrl={reciter.image_url || undefined}
          reciterName={reciter.name}
          style={styles.glowImage}
          blurRadius={60}
        />
      </View>
      <ReciterImage
        imageUrl={reciter.image_url || undefined}
        reciterName={reciter.name}
        style={styles.artwork}
      />
      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.subtitle}>
        {t('defaultReciter.fullQuran', {recitation: labels[selectedIndex]})}
      </Text>

      <View style={styles.preview}>
        <Pressable
          onPress={onTogglePreview}
          accessibilityRole="button"
          accessibilityLabel={
            isPlaying
              ? t('defaultReciter.pausePreview')
              : t('defaultReciter.playPreview', {name})
          }
          style={({pressed}) => [styles.playButton, pressed && styles.pressed]}>
          <Feather
            name={isPlaying ? 'pause' : 'play'}
            size={moderateScale(15)}
            color={theme.colors.background}
          />
        </Pressable>
        <View
          style={styles.wave}
          importantForAccessibility="no-hide-descendants">
          {WAVE.map((h, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {height: isPlaying ? h : Math.max(4, Math.round(h / 2.5))},
                i < filled && styles.barFilled,
              ]}
            />
          ))}
        </View>
        <Text style={styles.previewLabel}>
          {t('defaultReciter.previewSurah')}
        </Text>
      </View>

      {rewayat.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}>
          {rewayat.map((r, i) => {
            const selected = i === selectedIndex;
            return (
              <Pressable
                key={r.id}
                onPress={() => onSelectRewayat(r.id)}
                accessibilityRole="button"
                accessibilityState={{selected}}
                style={({pressed}) => [
                  styles.chip,
                  selected && styles.chipSelected,
                  pressed && styles.pressed,
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    selected && styles.chipTextSelected,
                  ]}>
                  {labels[i]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (theme: Theme, artworkSize: number) => {
  const text = Color(theme.colors.text);
  const glowSize = artworkSize * 1.9;
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingTop: moderateScale(8),
    },
    glow: {
      position: 'absolute',
      top: -artworkSize * 0.3,
      width: glowSize,
      height: glowSize,
      borderRadius: glowSize / 2,
      overflow: 'hidden',
      opacity: theme.isDarkMode ? 0.45 : 0.35,
    },
    glowImage: {
      width: '100%',
      height: '100%',
    },
    artwork: {
      width: artworkSize,
      height: artworkSize,
      borderRadius: artworkSize * 0.24,
      shadowColor: '#000',
      shadowOpacity: theme.isDarkMode ? 0.5 : 0.2,
      shadowRadius: 24,
      shadowOffset: {width: 0, height: 14},
      elevation: 12,
    },
    name: {
      marginTop: moderateScale(16),
      fontSize: moderateScale(26),
      lineHeight: moderateScale(32),
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
      textAlign: 'center',
    },
    subtitle: {
      marginTop: moderateScale(2),
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
      color: text.alpha(0.62).toString(),
      textAlign: 'center',
    },
    preview: {
      marginTop: moderateScale(14),
      alignSelf: 'stretch',
      height: moderateScale(52),
      borderRadius: moderateScale(26),
      backgroundColor: theme.isDarkMode
        ? text.alpha(0.1).toString()
        : 'rgba(255,255,255,0.65)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: text.alpha(0.1).toString(),
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(12),
      paddingStart: moderateScale(6),
      paddingEnd: moderateScale(16),
    },
    playButton: {
      width: moderateScale(40),
      height: moderateScale(40),
      borderRadius: moderateScale(20),
      backgroundColor: theme.colors.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wave: {
      flex: 1,
      height: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    bar: {
      width: 3,
      borderRadius: 2,
      backgroundColor: text.alpha(0.25).toString(),
    },
    barFilled: {
      backgroundColor: theme.colors.text,
    },
    previewLabel: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.semiBold,
      color: text.alpha(0.62).toString(),
    },
    chipsScroll: {
      alignSelf: 'stretch',
      marginTop: moderateScale(12),
    },
    chips: {
      gap: moderateScale(8),
    },
    chip: {
      height: moderateScale(34),
      paddingHorizontal: moderateScale(14),
      borderRadius: moderateScale(17),
      justifyContent: 'center',
      backgroundColor: theme.isDarkMode
        ? text.alpha(0.08).toString()
        : 'rgba(255,255,255,0.6)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: text.alpha(0.14).toString(),
    },
    chipSelected: {
      backgroundColor: theme.colors.text,
      borderColor: theme.colors.text,
    },
    chipText: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
    },
    chipTextSelected: {
      color: theme.colors.background,
    },
    pressed: {
      opacity: 0.7,
    },
  });
};
