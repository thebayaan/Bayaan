import React from 'react';
import {Image} from 'expo-image';
import {ScrollView, Text, TVFocusGuideView, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {FocusIcon, FocusText} from '../primitives/focusContext';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';
import {CheckIcon} from '../../../components/Icons';
import type {ArtworkSource} from '../../services/reciterArtwork';

export type PanelOption<T> = {
  value: T;
  label: string;
  detail?: string;
  /** A round portrait before the label (reciter pickers). */
  face?: {source: ArtworkSource | null; name: string};
};

export type PanelSection<T = unknown> = {
  title: string;
  options: readonly PanelOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
};

type Props = {
  title: string;
  sections: PanelSection<any>[];
  /** Any press inside the panel, so the player keeps its controls up. */
  onActivity: () => void;
};

/**
 * A settings panel that slides in from the right beside the controls tray.
 * The player stays visible behind it, so a change previews live. Focus is
 * kept inside the panel; Back closes it.
 */
export function SidePanel({
  title,
  sections,
  onActivity,
}: Props): React.ReactElement {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <TVFocusGuideView
          autoFocus
          trapFocusLeft
          trapFocusRight
          trapFocusUp
          trapFocusDown>
          {sections.map((section, si) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.options.map((option, oi) => {
                const selected = Object.is(option.value, section.selected);
                // With nothing selected (the queue), focus the first option.
                const noneSelected = !section.options.some(o =>
                  Object.is(o.value, section.selected),
                );
                return (
                  <FocusableButton
                    key={String(option.value)}
                    onPress={() => {
                      onActivity();
                      section.onSelect(option.value);
                    }}
                    accessibilityLabel={
                      selected ? `${option.label}, selected` : option.label
                    }
                    hasTVPreferredFocus={
                      si === 0 && (selected || (noneSelected && oi === 0))
                    }
                    focusScale={1.02}
                    style={styles.option}>
                    {option.face ? <Face {...option.face} /> : null}
                    <View style={styles.optionText}>
                      <FocusText
                        style={styles.label}
                        color={selected ? colors.text : colors.textSecondary}
                        numberOfLines={1}>
                        {option.label}
                      </FocusText>
                      {option.detail ? (
                        <FocusText
                          style={styles.detail}
                          color={colors.textTertiary}
                          focusedColor={colors.onFocusSecondary}
                          numberOfLines={1}>
                          {option.detail}
                        </FocusText>
                      ) : null}
                    </View>
                    {selected ? (
                      <FocusIcon
                        icon={CheckIcon}
                        color={colors.accent}
                        size={26}
                      />
                    ) : null}
                  </FocusableButton>
                );
              })}
            </View>
          ))}
        </TVFocusGuideView>
      </ScrollView>
    </View>
  );
}

function Face({
  source,
  name,
}: {
  source: ArtworkSource | null;
  name: string;
}): React.ReactElement {
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
        <Text style={styles.faceInitial}>{name.charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}

const styles = createScaledStyles({
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 620,
    backgroundColor: 'rgba(6,21,28,0.96)',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingTop: 64,
    paddingHorizontal: 40,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 32,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  scroll: {flex: 1},
  content: {paddingBottom: 64},
  section: {marginTop: 18, gap: 4},
  sectionTitle: {
    color: colors.accent,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 14,
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
    borderRadius: 14,
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
    fontSize: 16,
    marginTop: 2,
  },
});
