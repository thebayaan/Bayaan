// @ai-generated
import React, {useMemo} from 'react';
import {View, Text, Pressable, ScrollView, StyleSheet} from 'react-native';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {moderateScale} from '@/utils/scale';
import type {Reciter} from '@/data/reciterData';
import {ReciterImage} from '@/components/ReciterImage';
import {getReciterDisplayName} from '@/i18n/format';
import {settingsTokens} from './settingsTokens';

interface Props {
  reciters: Reciter[];
  currentId: string;
  onPick: (reciter: Reciter) => void;
  avatarSize: number;
}

/** The user's favorite reciters as a row of circles; the default is ringed. */
export function FavoritesShelf({
  reciters,
  currentId,
  onPick,
  avatarSize,
}: Props) {
  const {theme} = useTheme();
  const {t} = useTranslation('settings');
  const styles = useMemo(
    () => createStyles(theme, avatarSize),
    [theme, avatarSize],
  );
  if (reciters.length === 0) return null;

  return (
    <View>
      <Text style={styles.header}>{t('defaultReciter.favorites')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {reciters.map(reciter => {
          const name = getReciterDisplayName(reciter);
          const current = reciter.id === currentId;
          return (
            <Pressable
              key={reciter.id}
              onPress={() => onPick(reciter)}
              accessibilityRole="button"
              accessibilityLabel={name}
              accessibilityState={{selected: current}}
              style={({pressed}) => [styles.item, pressed && styles.pressed]}>
              <View style={[styles.ring, current && styles.ringOn]}>
                <ReciterImage
                  imageUrl={reciter.image_url || undefined}
                  reciterName={reciter.name}
                  style={styles.avatar}
                />
              </View>
              <Text style={styles.name} numberOfLines={2}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme, avatarSize: number) => {
  const ringSize = avatarSize + 10;
  const tokens = settingsTokens(theme);
  return StyleSheet.create({
    header: tokens.header,
    row: {
      gap: moderateScale(10),
      paddingHorizontal: moderateScale(4),
    },
    item: {
      width: ringSize + 12,
      alignItems: 'center',
      gap: moderateScale(6),
    },
    ring: {
      width: ringSize,
      height: ringSize,
      borderRadius: ringSize / 2,
      borderWidth: 2,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringOn: {
      borderColor: theme.colors.text,
    },
    avatar: {
      width: avatarSize,
      height: avatarSize,
      borderRadius: avatarSize / 2,
    },
    name: {
      fontSize: tokens.smallSize,
      lineHeight: tokens.smallSize * 1.3,
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.8).toString(),
      textAlign: 'center',
    },
    pressed: {
      opacity: 0.7,
    },
  });
};
