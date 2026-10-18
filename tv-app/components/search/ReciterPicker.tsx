import React from 'react';
import {FlatList, Text, TVFocusGuideView, View} from 'react-native';
import {PortraitCard} from './ResultCards';
import {FocusableButton, FocusText} from '../primitives/FocusableButton';
import {colors} from '../../theme/colors';
import {fonts, typography} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';
import type {Surah} from '../../../data/surahData';
import type {Reciter} from '../../types/reciter';

const COLUMNS = 5;

type Props = {
  surah: Surah;
  reciters: readonly Reciter[];
  onPick: (reciter: Reciter) => void;
  onCancel: () => void;
};

/**
 * "Choose reciter" for a surah, in place of the results: the reciters who
 * recite it, your default and favourites first. Back (or Cancel) returns to
 * the results.
 *
 * The header is a focus guide across the full width, so Up from any column
 * of the grid lands on Cancel (on tvOS only the last column sits under it).
 */
export function ReciterPicker({
  surah,
  reciters,
  onPick,
  onCancel,
}: Props): React.ReactElement {
  return (
    <View style={styles.root}>
      <TVFocusGuideView autoFocus style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>Choose a reciter</Text>
          <Text style={styles.title} numberOfLines={1}>
            {surah.name}
          </Text>
          <Text style={styles.meta}>
            {reciters.length} reciters recite it · Back returns to your results
          </Text>
        </View>
        <FocusableButton
          onPress={onCancel}
          accessibilityLabel="Cancel"
          style={styles.cancel}>
          <FocusText style={styles.cancelText}>Cancel</FocusText>
        </FocusableButton>
      </TVFocusGuideView>
      <TVFocusGuideView autoFocus style={styles.gridWrap}>
        <FlatList
          data={reciters as Reciter[]}
          keyExtractor={r => r.id}
          numColumns={COLUMNS}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          initialNumToRender={15}
          windowSize={5}
          renderItem={({item, index}) => (
            <View style={styles.cell}>
              <PortraitCard
                reciter={item}
                onPress={onPick}
                size={140}
                idPrefix="search-pick"
                hasTVPreferredFocus={index === 0}
              />
            </View>
          )}
        />
      </TVFocusGuideView>
    </View>
  );
}

const styles = createScaledStyles({
  root: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 24,
    marginBottom: 28,
  },
  headerText: {flex: 1, gap: 6},
  kicker: {...typography.label, color: colors.accent},
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  meta: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 18,
    fontWeight: '500',
  },
  cancel: {
    height: 60,
    paddingHorizontal: 26,
    borderRadius: 16,
    justifyContent: 'center',
  },
  cancelText: {fontFamily: fonts.bold, fontSize: 20, fontWeight: '700'},
  gridWrap: {flex: 1},
  grid: {paddingBottom: 90, paddingTop: 6},
  gridRow: {gap: 20, marginBottom: 20},
  cell: {width: 182, alignItems: 'center'},
});
