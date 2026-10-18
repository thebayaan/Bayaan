import React, {useMemo} from 'react';
import {Image} from 'expo-image';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {FocusIcon, FocusText} from '../primitives/focusContext';
import {useContextMenuStore} from '../../store/contextMenuStore';
import {useReciters} from '../../hooks/useReciters';
import {useFavorites} from '../../hooks/useFavorites';
import {useNavStore} from '../../store/navStore';
import {
  chooseRewayah,
  playOrOpen,
  randomSurah,
} from '../../services/playbackRouting';
import {toggleFavorite} from '../../services/favoritesStore';
import {fetchRewayat, getCachedRewayat} from '../../services/tvDataService';
import {
  HeartIcon,
  PlayIcon,
  ShuffleIcon,
  InfoRoundedIcon,
} from '../../../components/Icons';
import {colors} from '../../theme/colors';
import {spacing} from '../../theme/spacing';
import {createScaledStyles} from '../../theme/scale';
import {getReciterArtwork} from '../../services/reciterArtwork';

export function ReciterContextMenu(): React.ReactElement | null {
  const reciterId = useContextMenuStore(s =>
    s.target?.kind === 'reciter' ? s.target.reciterId : null,
  );
  const close = useContextMenuStore(s => s.close);
  const {reciters} = useReciters();
  const favorites = useFavorites();
  const push = useNavStore(s => s.push);

  const reciter = useMemo(
    () => (reciterId ? reciters.find(r => r.id === reciterId) : null),
    [reciters, reciterId],
  );

  if (!reciterId || !reciter) return null;

  const isFav = favorites.some(f => f.reciterId === reciterId);

  async function ensureRewayat(): Promise<
    Awaited<ReturnType<typeof fetchRewayat>>
  > {
    if (!reciterId) return [];
    const cached = getCachedRewayat(reciterId);
    if (cached && cached.length > 0) return cached;
    return fetchRewayat(reciterId);
  }

  // The menu closes at once; the player opens and shows any failure.
  async function handlePlay(): Promise<void> {
    if (!reciter) return;
    close();
    const rewayah = chooseRewayah(await ensureRewayat(), 1);
    const first = rewayah?.surah_list.find(n => n > 0) ?? 1;
    void playOrOpen({
      reciterId: reciter.id,
      rewayahId: rewayah?.id,
      surahNumber: first,
      source: 'reciter-menu',
    });
  }

  async function handleShuffle(): Promise<void> {
    if (!reciter) return;
    close();
    const rewayat = await ensureRewayat();
    const rewayah = chooseRewayah(rewayat, 1) ?? rewayat[0];
    void playOrOpen({
      reciterId: reciter.id,
      rewayahId: rewayah?.id,
      surahNumber: (rewayah && randomSurah(rewayah.surah_list)) ?? 1,
      shuffle: true,
      source: 'reciter-menu',
    });
  }

  function handleFavorite(): void {
    if (!reciterId) return;
    toggleFavorite(reciterId);
  }

  function handleOpenDetail(): void {
    if (!reciterId) return;
    close();
    push({screen: 'reciterDetail', reciterId});
  }

  const artwork = getReciterArtwork(reciter);
  return (
    <View style={menuStyles.scrim}>
      <View style={menuStyles.sheet}>
        <View style={menuStyles.header}>
          {artwork ? (
            <Image
              source={artwork}
              style={menuStyles.portrait}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[menuStyles.portrait, menuStyles.portraitPlaceholder]}>
              <Text style={menuStyles.initial}>
                {reciter.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={menuStyles.headerMeta}>
            <Text style={menuStyles.kicker}>RECITER</Text>
            <Text style={menuStyles.name} numberOfLines={2}>
              {reciter.name}
            </Text>
          </View>
        </View>
        <View style={menuStyles.rows}>
          <MenuRow
            icon={<FocusIcon icon={PlayIcon} size={20} />}
            label="Play"
            onPress={handlePlay}
            hasTVPreferredFocus
          />
          <MenuRow
            icon={<FocusIcon icon={ShuffleIcon} size={20} />}
            label="Shuffle play"
            onPress={handleShuffle}
          />
          <MenuRow
            icon={<FocusIcon icon={HeartIcon} size={20} filled={isFav} />}
            label={isFav ? 'Remove from favorites' : 'Add to favorites'}
            onPress={handleFavorite}
          />
          <MenuRow
            icon={<FocusIcon icon={InfoRoundedIcon} size={20} />}
            label="Open reciter page"
            onPress={handleOpenDetail}
          />
        </View>
      </View>
    </View>
  );
}

export type MenuRowProps = {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
};

export function MenuRow({
  icon,
  label,
  onPress,
  hasTVPreferredFocus,
}: MenuRowProps): React.ReactElement {
  return (
    <FocusableButton
      onPress={onPress}
      accessibilityLabel={label}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={menuStyles.row}>
      <View style={menuStyles.rowInner}>
        <View style={menuStyles.iconBubble}>{icon}</View>
        <FocusText style={menuStyles.rowLabel}>{label}</FocusText>
      </View>
    </FocusableButton>
  );
}

export const menuStyles = createScaledStyles({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
  },
  sheet: {
    width: 520,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 16,
    gap: spacing.md,
  },
  header: {flexDirection: 'row', alignItems: 'center', gap: 18},
  portrait: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceElevated,
  },
  portraitPlaceholder: {alignItems: 'center', justifyContent: 'center'},
  initial: {color: colors.text, fontSize: 32, fontWeight: '300', opacity: 0.55},
  headerMeta: {flex: 1, gap: 4},
  kicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  rows: {gap: 6, marginTop: 6},
  row: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },
  rowInner: {flexDirection: 'row', alignItems: 'center', gap: 14},
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    flex: 1,
  },
});
