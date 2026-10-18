import React from 'react';
import {ScrollView, Text, TVFocusGuideView, View} from 'react-native';
import {AdhkarResultCard, PortraitCard, SurahResultCard} from './ResultCards';
import type {GroupedResults} from '../../services/search/tvSearch';
import type {AdhkarList} from '../../services/adhkarData';
import {colors} from '../../theme/colors';
import {typography} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';
import type {Surah} from '../../../data/surahData';
import type {Reciter} from '../../types/reciter';

type Props = {
  results: GroupedResults;
  onSurah: (surah: Surah) => void;
  onReciter: (reciter: Reciter) => void;
  onAdhkar: (list: AdhkarList) => void;
};

/** More surahs, Reciters and Adhkar under the top result, one row each. */
export function ResultSections({
  results,
  onSurah,
  onReciter,
  onAdhkar,
}: Props): React.ReactElement {
  return (
    <View style={styles.sections}>
      {results.surahs.length > 0 ? (
        <Section title="More surahs">
          {results.surahs.map(s => (
            <SurahResultCard
              key={s.id}
              surah={s}
              onPress={onSurah}
              idPrefix="search-more"
            />
          ))}
        </Section>
      ) : null}
      {results.reciters.length > 0 ? (
        <Section title="Reciters">
          {results.reciters.map(r => (
            <PortraitCard
              key={r.id}
              reciter={r}
              onPress={onReciter}
              idPrefix="search-more-r"
            />
          ))}
        </Section>
      ) : null}
      {results.adhkar.length > 0 ? (
        <Section title="Adhkar">
          {results.adhkar.map(a => (
            <AdhkarResultCard key={a.id} list={a} onPress={onAdhkar} />
          ))}
        </Section>
      ) : null}
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View>
      <Text style={styles.kicker}>{title}</Text>
      {/* Down into a row lands where it was left, or on its first card. */}
      <TVFocusGuideView autoFocus>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          style={styles.scroller}>
          {children}
        </ScrollView>
      </TVFocusGuideView>
    </View>
  );
}

const styles = createScaledStyles({
  sections: {gap: 36, marginTop: 48},
  kicker: {...typography.label, color: colors.accent, marginBottom: 14},
  // Room for the focus scale and shadow, so the first card isn't clipped.
  scroller: {marginHorizontal: -12},
  row: {gap: 22, paddingHorizontal: 12, paddingVertical: 10},
});
