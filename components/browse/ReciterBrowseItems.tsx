// @ai-generated
/**
 * The pieces of Browse › All reciters: a panel row and a small card, each
 * with a ••• button for the reciter's options (open, share, play all,
 * shuffle all, favourite). The menu itself comes from the screen, so these
 * stay light to scroll.
 */
import React, {useState, type ReactNode} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Feather, Ionicons} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import type {Reciter} from '@/data/reciterData';
import {ReciterImage} from '@/components/ReciterImage';
import {
  PANEL_ART_GAP,
  PANEL_ART_SIZE,
  PANEL_ROW_PADDING,
  PANEL_ROW_VERTICAL,
  PANEL_RADIUS,
  PanelRow,
  usePanelColor,
} from '@/components/collection/CollectionPanel';

export interface ReciterItemProps {
  reciter: Reciter;
  name: string;
  line: string;
  downloaded: boolean;
  /** 'play' where a tap plays a surah (choosing for a surah). */
  trailing: 'options' | 'play';
  onPress: (reciter: Reciter) => void;
  /**
   * Wraps the ••• button in the reciter's options menu (iOS), or returns
   * it as is when `onOptions` opens a sheet instead.
   */
  renderOptions: (reciter: Reciter, button: ReactNode) => ReactNode;
  onOptions?: (reciter: Reciter) => void;
}

function RoundPhoto({reciter, size}: {reciter: Reciter; size: number}) {
  const {theme} = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Color(theme.colors.text).alpha(0.12).toString(),
      }}>
      <ReciterImage
        imageUrl={reciter.image_url || undefined}
        reciterName={reciter.name}
        style={{width: '100%', height: '100%', borderRadius: size}}
        profileIconSize={size * 0.4}
      />
    </View>
  );
}

/** The ••• button. A native menu wraps it; otherwise it opens the sheet. */
function OptionsButton({
  reciter,
  name,
  size,
  renderOptions,
  onOptions,
}: {
  reciter: Reciter;
  name: string;
  size: number;
  renderOptions: ReciterItemProps['renderOptions'];
  onOptions?: (reciter: Reciter) => void;
}) {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const glyph = (
    <Ionicons
      name="ellipsis-horizontal"
      size={size}
      color={Color(theme.colors.text).alpha(0.6).toString()}
    />
  );
  const button = onOptions ? (
    <Pressable
      onPress={() => onOptions(reciter)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t('browse.reciterOptions', {name})}
      style={({pressed}) => [styles.optionsButton, pressed && {opacity: 0.5}]}>
      {glyph}
    </Pressable>
  ) : (
    <View
      style={styles.optionsButton}
      accessibilityRole="button"
      accessibilityLabel={t('browse.reciterOptions', {name})}>
      {glyph}
    </View>
  );
  return <>{renderOptions(reciter, button)}</>;
}

/** One reciter in an inset panel. */
export const ReciterPanelRow = React.memo(function ReciterPanelRow({
  first,
  last,
  ...props
}: ReciterItemProps & {first: boolean; last: boolean}) {
  const {theme} = useTheme();
  const {reciter, name, line, downloaded, trailing, onPress} = props;
  const [pressed, setPressed] = useState(false);
  const muted = Color(theme.colors.text).alpha(0.55).toString();
  const playGlyph = (
    <Ionicons
      name="play"
      size={moderateScale(16)}
      color={Color(theme.colors.text).alpha(0.8).toString()}
    />
  );
  // The ••• sits beside the row's Pressable, not inside it, so the native
  // menu gets the tap instead of the row.
  return (
    <PanelRow first={first} last={last}>
      <View
        style={[
          styles.row,
          pressed && {
            backgroundColor: Color(theme.colors.text).alpha(0.05).toString(),
          },
        ]}>
        <Pressable
          onPress={() => onPress(reciter)}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          accessibilityRole="button"
          accessibilityLabel={name}
          accessibilityHint={line}
          style={styles.rowMain}>
          <RoundPhoto reciter={reciter} size={PANEL_ART_SIZE} />
          <View style={styles.rowText}>
            <View style={styles.nameLine}>
              <Text
                style={[styles.name, {color: theme.colors.text}]}
                numberOfLines={1}>
                {name}
              </Text>
              {downloaded ? (
                <Feather
                  name="arrow-down-circle"
                  size={moderateScale(12)}
                  color={muted}
                />
              ) : null}
            </View>
            <Text style={[styles.line, {color: muted}]} numberOfLines={1}>
              {line}
            </Text>
          </View>
          {trailing === 'play' ? (
            <View style={styles.trailing}>{playGlyph}</View>
          ) : null}
        </Pressable>
        {trailing === 'options' ? (
          <View style={styles.trailing}>
            <OptionsButton
              reciter={reciter}
              name={name}
              size={moderateScale(18)}
              renderOptions={props.renderOptions}
              onOptions={props.onOptions}
            />
          </View>
        ) : null}
      </View>
    </PanelRow>
  );
});

/** One reciter as a small card, three to a row on phones. */
export const ReciterCard = React.memo(function ReciterCard({
  width,
  ...props
}: ReciterItemProps & {width: number}) {
  const {theme} = useTheme();
  const panel = usePanelColor();
  const {reciter, name, line, downloaded, trailing, onPress} = props;
  const photo = Math.round(width - moderateScale(24));
  const muted = Color(theme.colors.text).alpha(0.55).toString();
  return (
    <View style={{width}}>
      <Pressable
        onPress={() => onPress(reciter)}
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityHint={line}
        style={({pressed}) => [
          styles.card,
          {width, backgroundColor: panel},
          pressed && {opacity: 0.85},
        ]}>
        <RoundPhoto reciter={reciter} size={photo} />
        <View style={styles.cardNameLine}>
          <Text
            style={[styles.cardName, {color: theme.colors.text}]}
            numberOfLines={1}>
            {name}
          </Text>
          {downloaded ? (
            <Feather
              name="arrow-down-circle"
              size={moderateScale(10)}
              color={muted}
            />
          ) : null}
        </View>
        <Text style={[styles.cardLine, {color: muted}]} numberOfLines={1}>
          {line}
        </Text>
      </Pressable>
      {trailing === 'options' ? (
        <View style={styles.cardOptions}>
          <OptionsButton
            reciter={reciter}
            name={name}
            size={moderateScale(15)}
            renderOptions={props.renderOptions}
            onOptions={props.onOptions}
          />
        </View>
      ) : null}
    </View>
  );
});

export const CARD_GAP = moderateScale(8);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingEnd: moderateScale(14),
    gap: PANEL_ART_GAP,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingStart: PANEL_ROW_PADDING,
    paddingVertical: PANEL_ROW_VERTICAL,
    gap: PANEL_ART_GAP,
  },
  rowText: {flex: 1, minWidth: 0, gap: moderateScale(2)},
  nameLine: {flexDirection: 'row', alignItems: 'center', gap: moderateScale(5)},
  name: {
    flexShrink: 1,
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-SemiBold',
    textAlign: 'left',
  },
  line: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-Medium',
    textAlign: 'left',
  },
  trailing: {
    minWidth: moderateScale(30),
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: PANEL_RADIUS * 0.75,
    borderCurve: 'continuous',
    alignItems: 'center',
    paddingTop: moderateScale(12),
    paddingBottom: moderateScale(10),
    paddingHorizontal: moderateScale(6),
  },
  cardNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(3),
    marginTop: moderateScale(8),
    maxWidth: '100%',
  },
  cardName: {
    flexShrink: 1,
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-SemiBold',
    textAlign: 'center',
  },
  cardLine: {
    marginTop: moderateScale(1),
    fontSize: moderateScale(10.5),
    fontFamily: 'Manrope-Medium',
    textAlign: 'center',
  },
  optionsButton: {
    minWidth: moderateScale(28),
    minHeight: moderateScale(28),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardOptions: {
    position: 'absolute',
    top: moderateScale(2),
    end: moderateScale(2),
  },
});
