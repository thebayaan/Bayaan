import React, {useMemo} from 'react';
import {Image} from 'expo-image';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {useContextMenuStore} from '../../store/contextMenuStore';
import {useReciters} from '../../hooks/useReciters';
import {useFavorites} from '../../hooks/useFavorites';
import {useNavStore} from '../../store/navStore';
import {usePlayer} from '../../hooks/usePlayer';
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

export function ReciterContextMenu(): React.ReactElement | null {
  const reciterId = useContextMenuStore(s => s.reciterId);
  const close = useContextMenuStore(s => s.close);
  const {reciters} = useReciters();
  const favorites = useFavorites();
  const push = useNavStore(s => s.push);
  const {playRewayah, shufflePlayRewayah} = usePlayer();

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

  async function handlePlay(): Promise<void> {
    if (!reciter) return;
    const rewayat = await ensureRewayat();
    const rewayah = rewayat[0];
    if (!rewayah) return;
    const first = rewayah.surah_list.find(n => n > 0);
    if (first === undefined) return;
    close();
    await playRewayah(reciter.id, reciter.name, rewayah, first);
    push({screen: 'nowPlaying'});
  }

  async function handleShuffle(): Promise<void> {
    if (!reciter) return;
    const rewayat = await ensureRewayat();
    const rewayah = rewayat[0];
    if (!rewayah) return;
    close();
    await shufflePlayRewayah(reciter.id, reciter.name, rewayah);
    push({screen: 'nowPlaying'});
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

  return (
    <View style={styles.scrim}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          {reciter.image_url ? (
            <Image
              source={{uri: reciter.image_url}}
              style={styles.portrait}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.portrait, styles.portraitPlaceholder]}>
              <Text style={styles.initial}>
                {reciter.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.headerMeta}>
            <Text style={styles.kicker}>RECITER</Text>
            <Text style={styles.name} numberOfLines={2}>
              {reciter.name}
            </Text>
          </View>
        </View>
        <View style={styles.rows}>
          <MenuRow
            icon={<PlayIcon color={colors.text} size={20} />}
            label="Play"
            onPress={handlePlay}
            hasTVPreferredFocus
          />
          <MenuRow
            icon={<ShuffleIcon color={colors.text} size={20} />}
            label="Shuffle play"
            onPress={handleShuffle}
          />
          <MenuRow
            icon={<HeartIcon color={colors.text} size={20} filled={isFav} />}
            label={isFav ? 'Remove from favorites' : 'Add to favorites'}
            onPress={handleFavorite}
          />
          <MenuRow
            icon={<InfoRoundedIcon color={colors.text} size={20} />}
            label="Open reciter page"
            onPress={handleOpenDetail}
          />
        </View>
      </View>
    </View>
  );
}

type MenuRowProps = {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
};

function MenuRow({
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
      style={styles.row}>
      <View style={styles.rowInner}>
        <View style={styles.iconBubble}>{icon}</View>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
    </FocusableButton>
  );
}

const styles = StyleSheet.create({
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
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    opacity: 0.55,
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
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rowInner: {flexDirection: 'row', alignItems: 'center', gap: 14},
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    flex: 1,
  },
});
