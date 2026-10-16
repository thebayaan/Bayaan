import React from 'react';
import {Text, TVFocusGuideView, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {FocusableButton, FocusText} from '../primitives/FocusableButton';
import {GradientFill} from '../brand/GradientFill';
import {SurahGlyph} from '../brand/SurahGlyph';
import {HandsGlyph} from './SearchGlyphs';
import {SURAHS, type Surah} from '../../../data/surahData';
import {
  ADHKAR_LISTS,
  adhkarCount,
  type AdhkarList,
} from '../../services/adhkarData';
import {
  ADHKAR_WHEN,
  adhkarGradient,
  countLabel,
} from '../../services/search/adhkarArt';
import {surahGradient} from '../../theme/surahColors';
import {colors} from '../../theme/colors';
import {fonts, typography} from '../../theme/typography';
import {createScaledStyles, scale} from '../../theme/scale';
import type {TabKey} from '../../store/navStore';

type SurahEntry = {surah: number; title: string; subtitle: string};

const SURAH_ENTRIES: readonly SurahEntry[] = [
  {surah: 18, title: 'For Friday', subtitle: 'Al-Kahf'},
  {surah: 78, title: 'Juz ʿAmma', subtitle: 'An-Naba to An-Nas'},
  {surah: 67, title: 'Every night', subtitle: 'Al-Mulk'},
];

const ADHKAR_ENTRIES = ['morning-adhkar', 'evening-adhkar', 'before-sleep'];

const BROWSE_ALL: readonly {tab: TabKey; label: string}[] = [
  {tab: 'surahs', label: 'All surahs'},
  {tab: 'reciters', label: 'All reciters'},
  {tab: 'adhkar', label: 'All adhkar'},
];

const surahById = new Map(SURAHS.map(s => [s.id, s]));

type Props = {
  onSurah: (surah: Surah) => void;
  onAdhkar: (list: AdhkarList) => void;
  onBrowseAll: (tab: TabKey) => void;
};

/** The right side before typing: ways in that need no typing at all. */
export function BrowsePanel({
  onSurah,
  onAdhkar,
  onBrowseAll,
}: Props): React.ReactElement {
  const lists = ADHKAR_ENTRIES.flatMap(id => {
    const list = ADHKAR_LISTS.find(l => l.id === id);
    return list ? [list] : [];
  });
  return (
    <View>
      <Text style={styles.kicker}>Browse</Text>
      <TVFocusGuideView autoFocus style={styles.row}>
        {SURAH_ENTRIES.map(entry => {
          const surah = surahById.get(entry.surah);
          if (!surah) return null;
          return (
            <BrowseTile
              key={entry.surah}
              id={`search-browse-s${entry.surah}`}
              colors={surahGradient(entry.surah)}
              title={entry.title}
              subtitle={entry.subtitle}
              art={
                <SurahGlyph
                  surahNumber={entry.surah}
                  size={96}
                  color="rgba(244,243,236,0.28)"
                />
              }
              onPress={() => onSurah(surah)}
            />
          );
        })}
      </TVFocusGuideView>

      <Text style={[styles.kicker, styles.kickerGap]}>Adhkar</Text>
      <TVFocusGuideView autoFocus style={styles.row}>
        {lists.map(list => {
          const when = ADHKAR_WHEN[list.id];
          const count = countLabel(adhkarCount(list.id));
          return (
            <BrowseTile
              key={list.id}
              id={`search-browse-${list.id}`}
              colors={adhkarGradient(list)}
              title={list.title}
              subtitle={when ? `${when} · ${count}` : count}
              art={
                <HandsGlyph color="rgba(244,243,236,0.22)" size={scale(84)} />
              }
              onPress={() => onAdhkar(list)}
            />
          );
        })}
      </TVFocusGuideView>

      <TVFocusGuideView autoFocus style={[styles.row, styles.allRow]}>
        {BROWSE_ALL.map(entry => (
          <FocusableButton
            key={entry.tab}
            onPress={() => onBrowseAll(entry.tab)}
            accessibilityLabel={entry.label}
            outlined
            style={styles.allButton}>
            <FocusText style={styles.allText}>{entry.label}</FocusText>
          </FocusableButton>
        ))}
      </TVFocusGuideView>
    </View>
  );
}

function BrowseTile({
  id,
  colors: gradient,
  title,
  subtitle,
  art,
  onPress,
}: {
  id: string;
  colors: readonly [string, string];
  title: string;
  subtitle: string;
  art: React.ReactNode;
  onPress: () => void;
}): React.ReactElement {
  return (
    <FocusableCard
      onPress={onPress}
      accessibilityLabel={`${title}, ${subtitle}`}
      style={styles.tile}>
      <GradientFill colors={gradient} id={id} />
      <View style={styles.tileArt}>{art}</View>
      <Text style={styles.tileTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.tileSub} numberOfLines={1}>
        {subtitle}
      </Text>
    </FocusableCard>
  );
}

const TILE_GAP = 22;

const styles = createScaledStyles({
  kicker: {...typography.label, color: colors.accent, marginBottom: 16},
  kickerGap: {marginTop: 44},
  row: {flexDirection: 'row', gap: TILE_GAP},
  allRow: {marginTop: 48},
  tile: {
    width: 320,
    height: 176,
    borderRadius: 18,
    padding: 22,
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
  },
  tileArt: {
    position: 'absolute',
    right: 10,
    bottom: 4,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  tileTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  tileSub: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 17,
    fontWeight: '500',
  },
  allButton: {
    height: 60,
    paddingHorizontal: 28,
    borderRadius: 16,
    justifyContent: 'center',
  },
  allText: {fontFamily: fonts.bold, fontSize: 20, fontWeight: '700'},
});
