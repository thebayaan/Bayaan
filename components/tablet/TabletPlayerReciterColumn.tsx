import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {moderateScale} from '@/utils/scale';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {Surah, SURAHS} from '@/data/surahData';
import {Reciter, Rewayat} from '@/data/reciterData';
import {HAFS_REWAYAT_NAME} from '@/data/rewayat';
import {getReciterByIdSync} from '@/services/dataService';
import {useLoved} from '@/hooks/useLoved';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useDownloadQueries} from '@/services/player/store/downloadSelectors';
import {useSettings} from '@/hooks/useSettings';
import {SheetManager} from 'react-native-actions-sheet';
import {SurahList} from '@/components/reciter-profile/components/SurahList';
import {ReciterImage} from '@/components/ReciterImage';
import {Feather} from '@expo/vector-icons';

function sortRewayat(rewayat: Rewayat[]): Rewayat[] {
  return [...rewayat].sort((a, b) => {
    const aIsHafsMurattal =
      a.name === HAFS_REWAYAT_NAME && a.style === 'murattal';
    const bIsHafsMurattal =
      b.name === HAFS_REWAYAT_NAME && b.style === 'murattal';
    if (aIsHafsMurattal && !bIsHafsMurattal) return -1;
    if (!aIsHafsMurattal && bIsHafsMurattal) return 1;

    const aIsHafs = a.name === HAFS_REWAYAT_NAME;
    const bIsHafs = b.name === HAFS_REWAYAT_NAME;
    if (aIsHafs && !bIsHafs) return -1;
    if (!aIsHafs && bIsHafs) return 1;

    const aIsMurattal = a.style === 'murattal';
    const bIsMurattal = b.style === 'murattal';
    if (aIsMurattal && !bIsMurattal) return -1;
    if (!aIsMurattal && bIsMurattal) return 1;

    return 0;
  });
}

function initReciter(id: string): Reciter | null {
  const r = getReciterByIdSync(id);
  if (!r) return null;
  return {...r, rewayat: sortRewayat(r.rewayat)};
}

type SortOption = 'asc' | 'desc' | 'revelation';

/**
 * Right column beside the full player on iPad: reciter identity + rewayah chips + surah list.
 * Mirrors reciter profile playback behavior; opens full profile via header action.
 */
export const TabletPlayerReciterColumn: React.FC<{
  reciterId: string;
  initialRewayatId?: string;
}> = ({reciterId, initialRewayatId}) => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const {updateQueue} = usePlayerActions();
  const {navigateToReciterProfile} = useReciterNavigation();
  const {startNewChain} = useRecentlyPlayedStore();
  const {isLovedWithRewayat} = useLoved();
  const {isDownloaded} = useDownloadQueries();

  const sortOption = useSettings(s => s.reciterProfileSortOption) as SortOption;
  const viewMode = useSettings(s => s.reciterProfileViewMode);

  const reciter = useMemo(() => initReciter(reciterId), [reciterId]);

  const [selectedRewayatId, setSelectedRewayatId] = useState<
    string | undefined
  >(() => {
    if (!reciter) return undefined;
    if (
      initialRewayatId &&
      reciter.rewayat.some(r => r.id === initialRewayatId)
    ) {
      return initialRewayatId;
    }
    return reciter.rewayat[0]?.id;
  });

  useEffect(() => {
    if (!reciter) return;
    if (
      initialRewayatId &&
      reciter.rewayat.some(r => r.id === initialRewayatId)
    ) {
      setSelectedRewayatId(initialRewayatId);
    }
  }, [initialRewayatId, reciter]);

  const selectedRewayat = useMemo(() => {
    if (!reciter) return undefined;
    if (!selectedRewayatId) return reciter.rewayat[0];
    return (
      reciter.rewayat.find(r => r.id === selectedRewayatId) ||
      reciter.rewayat[0]
    );
  }, [reciter, selectedRewayatId]);

  const filteredSurahs = useMemo(() => {
    if (!reciter || !selectedRewayat) return [];
    let available = SURAHS;
    if (selectedRewayat.surah_list) {
      const valid = selectedRewayat.surah_list.filter(
        (id): id is number => id != null,
      );
      available = SURAHS.filter(s => valid.includes(s.id));
    }
    return [...available].sort((a, b) => {
      if (sortOption === 'asc') return a.id - b.id;
      if (sortOption === 'desc') return b.id - a.id;
      return a.revelation_order - b.revelation_order;
    });
  }, [reciter, selectedRewayat, sortOption]);

  const getColorForSurah = useCallback((id: number): string => {
    const colors = [
      '#059669',
      '#7C3AED',
      '#1E40AF',
      '#DC2626',
      '#EA580C',
      '#0891B2',
      '#BE185D',
      '#4F46E5',
      '#B45309',
      '#047857',
    ];
    return colors[id % colors.length];
  }, []);

  const isLoved = useCallback(
    (rid: string, surahId: string | number) => {
      if (!selectedRewayat) return false;
      return isLovedWithRewayat(rid, String(surahId), selectedRewayat.id);
    },
    [isLovedWithRewayat, selectedRewayat],
  );

  const handleSurahPress = useCallback(
    async (surah: Surah) => {
      if (!reciter || !selectedRewayat) return;
      try {
        const startIndex = filteredSurahs.findIndex(s => s.id === surah.id);
        if (startIndex === -1) return;

        const artwork = getReciterArtwork(reciter);
        const reordered = [
          filteredSurahs[startIndex],
          ...filteredSurahs.slice(startIndex + 1),
          ...filteredSurahs.slice(0, startIndex),
        ];

        const allTracks = reordered.map(s => ({
          id: `${reciter.id}:${s.id}`,
          url: generateSmartAudioUrl(
            reciter,
            s.id.toString(),
            selectedRewayat.id,
          ),
          title: s.name,
          artist: reciter.name,
          reciterId: reciter.id,
          artwork,
          surahId: s.id.toString(),
          reciterName: reciter.name,
          rewayatId: selectedRewayat.id,
        }));

        await updateQueue(allTracks, 0);
        startNewChain(reciter, surah, 0, 0, selectedRewayat.id);
      } catch (e) {
        console.error('TabletPlayerReciterColumn surah press', e);
      }
    },
    [reciter, filteredSurahs, selectedRewayat, startNewChain, updateQueue],
  );

  const handleOpenFullProfile = useCallback(() => {
    navigateToReciterProfile(reciterId);
  }, [navigateToReciterProfile, reciterId]);

  const onOptionsPress = useCallback(
    (surah: Surah) => {
      if (!selectedRewayat) return;
      SheetManager.show('surah-options', {
        payload: {
          surah,
          reciterId,
          rewayatId: selectedRewayat.id,
          hideGoToReciter: true,
        },
      });
    },
    [reciterId, selectedRewayat],
  );

  const divider = Color(theme.colors.text).alpha(0.08).toString();

  if (!reciter) {
    return (
      <View style={[styles.centered, {paddingTop: insets.top}]}>
        <ActivityIndicator color={theme.colors.textSecondary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, {backgroundColor: theme.colors.background}]}>
      <View
        style={[styles.header, {paddingTop: insets.top + moderateScale(8)}]}>
        <View style={styles.headerMain}>
          <ReciterImage
            reciterName={reciter.name}
            style={styles.avatar}
            profileIconSize={moderateScale(18)}
          />
          <View style={styles.headerTextWrap}>
            <Text
              style={[styles.reciterName, {color: theme.colors.text}]}
              numberOfLines={2}>
              {reciter.name}
            </Text>
            <Text
              style={[styles.sub, {color: theme.colors.textSecondary}]}
              numberOfLines={1}>
              {selectedRewayat
                ? `${selectedRewayat.name} · ${selectedRewayat.style}`
                : ''}
            </Text>
          </View>
          <Pressable
            onPress={handleOpenFullProfile}
            style={({pressed}) => [styles.openFull, pressed && {opacity: 0.6}]}
            hitSlop={12}>
            <Feather
              name="external-link"
              size={moderateScale(18)}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        </View>

        {reciter.rewayat.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rewayatScroll}>
            {reciter.rewayat.map(r => {
              const active = r.id === selectedRewayatId;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => setSelectedRewayatId(r.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active
                        ? Color(theme.colors.text).alpha(0.12).toString()
                        : Color(theme.colors.text).alpha(0.05).toString(),
                      borderColor: Color(theme.colors.text)
                        .alpha(0.08)
                        .toString(),
                    },
                  ]}>
                  <Text
                    style={[styles.chipText, {color: theme.colors.text}]}
                    numberOfLines={1}>
                    {r.name} · {r.style}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <View style={[styles.listDivider, {borderTopColor: divider}]} />

      <View style={styles.listFill}>
        <SurahList
          surahs={filteredSurahs}
          onSurahPress={handleSurahPress}
          reciterId={reciterId}
          isLoved={isLoved}
          isDownloaded={isDownloaded}
          onOptionsPress={onOptionsPress}
          viewMode={viewMode}
          getColorForSurah={getColorForSurah}
          sortOption={sortOption}
          rewayatId={selectedRewayat?.id}
          contentContainerStyle={{
            paddingBottom: insets.bottom + moderateScale(12),
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minWidth: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: moderateScale(12),
    paddingBottom: moderateScale(8),
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: moderateScale(10),
    minWidth: 0,
  },
  reciterName: {
    fontSize: moderateScale(15),
    fontFamily: 'Manrope-SemiBold',
  },
  sub: {
    fontSize: moderateScale(11),
    marginTop: moderateScale(2),
    textTransform: 'capitalize',
  },
  openFull: {
    padding: moderateScale(6),
  },
  rewayatScroll: {
    paddingTop: moderateScale(10),
    paddingRight: moderateScale(4),
  },
  chip: {
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    borderRadius: moderateScale(12),
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: moderateScale(6),
  },
  chipText: {
    fontSize: moderateScale(11),
    fontFamily: 'Manrope-Medium',
    maxWidth: moderateScale(200),
  },
  listDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  listFill: {
    flex: 1,
    minHeight: 0,
  },
});
