import React, {useEffect, useRef} from 'react';
import {Image} from 'expo-image';
import {ScrollView, Text, TVFocusGuideView, View} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
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
  /**
   * For a section where several options can be checked at once (the
   * playlists holding this surah). Focus then starts on the first option.
   */
  isSelected?: (value: T) => boolean;
  onSelect: (value: T) => void;
  /**
   * An option to move focus to when it appears (a longer list revealed in
   * place of its "All reciters" row), instead of the selected one.
   */
  focusOn?: T;
};

/** The panel's width in design pixels; the tray and verse keep clear of it. */
export const PANEL_WIDTH = 660;

type Props = {
  title: string;
  sections: PanelSection<any>[];
  /** Any press inside the panel, so the player keeps its controls up. */
  onActivity: () => void;
};

/**
 * A settings panel that slides in from the right beside the controls tray.
 * The verse moves left of it, so a change previews live. Focus is kept
 * inside the panel; Back closes it. A first section labelled like the panel
 * itself ("Repeat" under "Repeat") drops the label.
 */
export function SidePanel({
  title,
  sections,
  onActivity,
}: Props): React.ReactElement {
  // The selected row takes focus through hasTVPreferredFocus, which tvOS
  // can miss when the panel mounts while a tray tool still holds focus, so
  // the row is also asked for focus once the panel is up.
  const preferred = useRef<View>(null);
  useEffect(() => {
    const id = setTimeout(() => preferred.current?.requestTVFocus?.(), 0);
    return () => clearTimeout(id);
  }, [title]);
  const moveTo = useRef<View>(null);
  const focusOn = sections.find(section => section.focusOn !== undefined)
    ?.focusOn as unknown;
  useEffect(() => {
    if (focusOn === undefined) return;
    const id = setTimeout(() => moveTo.current?.requestTVFocus?.(), 0);
    return () => clearTimeout(id);
  }, [focusOn]);
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
              {si === 0 &&
              section.title.toLowerCase() === title.toLowerCase() ? null : (
                <Text style={styles.sectionTitle}>{section.title}</Text>
              )}
              {section.options.map((option, oi) => {
                const selected = section.isSelected
                  ? section.isSelected(option.value)
                  : Object.is(option.value, section.selected);
                // With nothing selected, focus the first option.
                const noneSelected =
                  section.isSelected !== undefined ||
                  !section.options.some(o =>
                    Object.is(o.value, section.selected),
                  );
                const focusFirst =
                  si === 0 &&
                  (section.isSelected
                    ? oi === 0
                    : selected || (noneSelected && oi === 0));
                return (
                  <FocusableButton
                    key={String(option.value)}
                    ref={
                      section.focusOn !== undefined &&
                      Object.is(option.value, section.focusOn)
                        ? moveTo
                        : focusFirst
                          ? preferred
                          : undefined
                    }
                    onPress={() => {
                      onActivity();
                      section.onSelect(option.value);
                    }}
                    accessibilityLabel={
                      selected ? `${option.label}, selected` : option.label
                    }
                    hasTVPreferredFocus={focusFirst}
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
      <BottomFade />
    </View>
  );
}

/**
 * The panel's colour fading in over the bottom edge, so a long list reads
 * as "more below" and its rows don't run into the bottom overscan.
 */
function BottomFade(): React.ReactElement {
  return (
    <View pointerEvents="none" accessible={false} style={styles.fade}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="side-panel-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.surface} stopOpacity={0} />
            <Stop offset="0.7" stopColor={colors.surface} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="url(#side-panel-fade)"
        />
      </Svg>
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
    width: PANEL_WIDTH,
    // Opaque: nothing of the room shows through the rows.
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingTop: 64,
    // The background runs to the screen's edge; the rows (and the focus
    // fill's scale) keep inside the title-safe area on the right.
    paddingLeft: 40,
    paddingRight: 96,
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
  // Room for the last row to scroll clear of the fade.
  content: {paddingBottom: 120},
  fade: {position: 'absolute', left: 0, right: 0, bottom: 0, height: 120},
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
