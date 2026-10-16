import React from 'react';
import {ScrollView, Text, TVFocusGuideView, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles, scale} from '../../theme/scale';
import {CheckIcon} from '../../../components/Icons';

export type PanelOption<T> = {value: T; label: string; detail?: string};

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
              {section.options.map(option => {
                const selected = Object.is(option.value, section.selected);
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
                    hasTVPreferredFocus={si === 0 && selected}
                    focusScale={1.02}
                    style={styles.option}>
                    <View style={styles.optionText}>
                      <Text
                        style={[styles.label, selected && styles.labelOn]}
                        numberOfLines={1}>
                        {option.label}
                      </Text>
                      {option.detail ? (
                        <Text style={styles.detail} numberOfLines={1}>
                          {option.detail}
                        </Text>
                      ) : null}
                    </View>
                    {selected ? (
                      <CheckIcon color={colors.accent} size={scale(26)} />
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

const styles = createScaledStyles({
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 620,
    backgroundColor: 'rgba(5,11,16,0.96)',
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
    fontSize: 15,
    letterSpacing: 2,
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
  label: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 22,
  },
  labelOn: {color: colors.text},
  detail: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 16,
    marginTop: 2,
    opacity: 0.8,
  },
});
