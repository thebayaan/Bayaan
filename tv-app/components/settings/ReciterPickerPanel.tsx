import React, {useCallback} from 'react';
import {Image} from 'expo-image';
import {FlatList, Text, TVFocusGuideView, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {FocusIcon, FocusText} from '../primitives/focusContext';
import {getReciterArtwork} from '../../services/reciterArtwork';
import type {Reciter} from '../../types/reciter';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';
import {CheckIcon} from '../../../components/Icons';

type Props = {
  title: string;
  /** The small label above the list. */
  subtitle: string;
  /** Already ordered; the selected reciter should come first. */
  reciters: readonly Reciter[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** A second line under each name, e.g. the recitation style. */
  detail?: (reciter: Reciter) => string;
};

/**
 * The default-reciter picker (Settings and onboarding's "Browse all
 * reciters"), drawn like the listening SidePanel but over the whole catalog:
 * the rows are virtualised, so 200+ reciters never mount (or load their
 * portraits) at once. Focus stays inside the panel; Back closes it.
 */
export function ReciterPickerPanel({
  title,
  subtitle,
  reciters,
  selectedId,
  onSelect,
  detail,
}: Props): React.ReactElement {
  const hasSelected = reciters.some(r => r.id === selectedId);
  const renderItem = useCallback(
    ({item, index}: {item: Reciter; index: number}) => {
      const selected = item.id === selectedId;
      return (
        <ReciterRow
          reciter={item}
          selected={selected}
          detail={detail?.(item) ?? ''}
          // The selected reciter, or the first one when none is.
          hasTVPreferredFocus={selected || (!hasSelected && index === 0)}
          onSelect={onSelect}
        />
      );
    },
    [selectedId, hasSelected, detail, onSelect],
  );

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>
      <TVFocusGuideView
        autoFocus
        trapFocusLeft
        trapFocusRight
        trapFocusUp
        trapFocusDown
        style={styles.guide}>
        <FlatList
          data={reciters as Reciter[]}
          keyExtractor={r => r.id}
          renderItem={renderItem}
          extraData={selectedId}
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>{subtitle}</Text>
          }
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          // Clipped rows lose their native views, which breaks focus search
          // on Android TV when moving onto them.
          removeClippedSubviews={false}
        />
      </TVFocusGuideView>
    </View>
  );
}

const ReciterRow = React.memo(function ReciterRow({
  reciter,
  selected,
  detail,
  hasTVPreferredFocus,
  onSelect,
}: {
  reciter: Reciter;
  selected: boolean;
  detail: string;
  hasTVPreferredFocus: boolean;
  onSelect: (id: string) => void;
}): React.ReactElement {
  return (
    <FocusableButton
      onPress={() => onSelect(reciter.id)}
      accessibilityLabel={selected ? `${reciter.name}, selected` : reciter.name}
      hasTVPreferredFocus={hasTVPreferredFocus}
      focusScale={1.02}
      style={styles.option}>
      <Face reciter={reciter} />
      <View style={styles.optionText}>
        <FocusText
          style={styles.label}
          color={selected ? colors.text : colors.textSecondary}
          numberOfLines={1}>
          {reciter.name}
        </FocusText>
        {detail ? (
          <FocusText
            style={styles.detail}
            color={colors.textSecondary}
            focusedColor={colors.onFocusSecondary}
            numberOfLines={1}>
            {detail}
          </FocusText>
        ) : null}
      </View>
      {selected ? (
        <FocusIcon icon={CheckIcon} color={colors.accent} size={26} />
      ) : null}
    </FocusableButton>
  );
});

/** Built only when its row renders, so off-screen portraits never load. */
function Face({reciter}: {reciter: Reciter}): React.ReactElement {
  const source = getReciterArtwork(reciter);
  return (
    <View style={styles.face}>
      {source ? (
        <Image
          source={source}
          style={styles.faceImg}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <Text style={styles.faceInitial}>
          {reciter.name.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

// Matches components/listening/SidePanel so every picker reads the same.
const styles = createScaledStyles({
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 620,
    // Opaque: nothing of the screen behind shows through the rows.
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingTop: 64,
    paddingLeft: 40,
    // The panel is flush right: a focused row stays inside the title-safe
    // area instead of running to 40px from the screen's edge.
    paddingRight: 80,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 32,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  guide: {flex: 1},
  content: {paddingTop: 18, paddingBottom: 64, gap: 4},
  sectionTitle: {
    color: colors.accent,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 16,
  },
  optionText: {flex: 1, minWidth: 0},
  face: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceImg: {width: '100%', height: '100%'},
  faceInitial: {color: colors.textSecondary, fontSize: 24, fontWeight: '600'},
  label: {
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 22,
  },
  detail: {
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 18,
    marginTop: 2,
  },
});
