import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {SurahCard} from './cards/SurahCard';
import {SURAHS, Surah} from '@/data/surahData';
import Color from 'color';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';

interface SurahsViewProps {
  onSurahPress: (surah: Surah) => void;
}

function getSurahOfTheDay(): Surah {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24),
  );
  const surahIndex = dayOfYear % 114;
  return SURAHS[surahIndex];
}

const HeroSection = ({
  surah,
  onPress,
}: {
  surah: Surah;
  onPress: (surah: Surah) => void;
}) => {
  const {theme} = useTheme();
  const handlePress = React.useCallback(() => onPress(surah), [surah, onPress]);

  const styles = StyleSheet.create({
    hero: {
      marginHorizontal: moderateScale(15),
      marginBottom: verticalScale(24),
      padding: moderateScale(20),
      borderRadius: moderateScale(24),
      backgroundColor: Color(theme.colors.primary).alpha(0.1).toString(),
    },
    heroTitle: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
      marginBottom: verticalScale(8),
    },
    heroSurahName: {
      fontSize: moderateScale(28),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: verticalScale(4),
    },
    heroGlyph: {
      fontSize: moderateScale(40),
      fontFamily: 'SurahNames',
      color: theme.colors.primary,
      marginBottom: verticalScale(12),
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: verticalScale(12),
      paddingTop: verticalScale(12),
    },
    stat: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: moderateScale(16),
      fontWeight: '600',
      color: theme.colors.text,
    },
    statLabel: {
      fontSize: moderateScale(12),
      color: theme.colors.textSecondary,
      marginTop: verticalScale(4),
    },
    translatedName: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
      marginBottom: verticalScale(8),
    },
  });

  return (
    <TouchableOpacity
      activeOpacity={0.99}
      style={styles.hero}
      onPress={handlePress}>
      <Text style={styles.heroTitle}>SURAH OF THE DAY</Text>
      <Text style={styles.heroGlyph}>{surahGlyphMap[surah.id]}</Text>
      <Text style={styles.heroSurahName}>{surah.name}</Text>
      <Text style={styles.translatedName}>{surah.translated_name_english}</Text>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{surah.verses_count}</Text>
          <Text style={styles.statLabel}>Verses</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{surah.revelation_place}</Text>
          <Text style={styles.statLabel}>Revealed</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{surah.id}</Text>
          <Text style={styles.statLabel}>Number</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const ItemSeparator = () => <View style={{width: moderateScale(12)}} />;

export default function SurahsView({onSurahPress}: SurahsViewProps) {
  const {theme} = useTheme();
  const {recentTracks} = useRecentlyPlayedStore();
  const {queue} = useUnifiedPlayer();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    section: {
      marginBottom: verticalScale(10),
    },
    sectionHeader: {
      marginBottom: verticalScale(5),
      paddingHorizontal: moderateScale(15),
    },
    sectionTitle: {
      fontSize: moderateScale(22),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: verticalScale(4),
    },
    sectionContent: {
      paddingHorizontal: moderateScale(15),
      paddingVertical: verticalScale(8),
    },
  });

  const recentSurahs = useMemo(() => {
    const seen = new Set();
    return recentTracks
      .map(item => item.surah)
      .filter(surah => {
        if (seen.has(surah.id)) {
          return false;
        }
        seen.add(surah.id);
        return true;
      })
      .slice(0, 5);
  }, [recentTracks]);

  const surahOfTheDay = useMemo(() => getSurahOfTheDay(), []);

  const lovedSurahs = useMemo(() => {
    const tracks = queue.tracks.filter(track => track.isLoved);
    const surahIds = tracks.map(track => parseInt(track.surahId || '0', 10));
    const uniqueSurahIds = [...new Set(surahIds)];
    return uniqueSurahIds
      .map(id => SURAHS.find(surah => surah.id === id))
      .filter((surah): surah is Surah => surah !== undefined)
      .slice(0, 5);
  }, [queue.tracks]);

  const mostPlayedSurahs = useMemo(() => {
    // Get play counts from queue tracks
    const playCounts = new Map<number, number>();
    queue.tracks.forEach(track => {
      const surahId = parseInt(track.surahId || '0', 10);
      if (surahId) {
        playCounts.set(
          surahId,
          (playCounts.get(surahId) || 0) + (track.playCount || 0),
        );
      }
    });

    // Sort by play count and get top 5
    const sortedSurahIds = Array.from(playCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    return sortedSurahIds
      .map(id => SURAHS.find(surah => surah.id === id))
      .filter((surah): surah is Surah => surah !== undefined);
  }, [queue.tracks]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Refresh your data here
    setRefreshing(false);
  };

  const renderSection = (title: string, data: Surah[]) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <FlatList
        data={data}
        renderItem={({item}) => (
          <SurahCard
            id={item.id}
            name={item.name}
            translatedName={item.translated_name_english}
            versesCount={item.verses_count}
            revelationPlace={item.revelation_place}
            onPress={() => onSurahPress(item)}
          />
        )}
        keyExtractor={item => item.id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.sectionContent,
          {paddingRight: moderateScale(15) + moderateScale(12)},
        ]}
        snapToInterval={moderateScale(172)}
        decelerationRate="fast"
        snapToAlignment="start"
        ItemSeparatorComponent={ItemSeparator}
      />
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{paddingVertical: verticalScale(20)}}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.text}
        />
      }>
      <HeroSection surah={surahOfTheDay} onPress={onSurahPress} />

      {recentSurahs.length > 0 &&
        renderSection('Recently Played', recentSurahs)}

      {mostPlayedSurahs.length > 0 &&
        renderSection('Most Played', mostPlayedSurahs)}

      {lovedSurahs.length > 0 &&
        renderSection('From your Collection', lovedSurahs)}
    </ScrollView>
  );
}
