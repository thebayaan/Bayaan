// @ai-generated
import React, {useCallback, useMemo} from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import branding from '@/config/branding';
import {useTheme} from '@/hooks/useTheme';
import {
  REWAYAH_FALLBACK_RENDERER_LABEL,
  getDkFontFamily,
  useMushafSettingsStore,
  type MushafRenderer,
  type RewayahId,
} from '@/store/mushafSettingsStore';
import {
  ALL_REWAYAH_IDS,
  getLongLabel,
  hasDiffData,
  hasTextData,
  type RewayahWithDiffs,
} from '@/services/rewayah/RewayahIdentity';
import {getRewayahDiffLegend} from '@/components/sheets/rewayahDiffLegend';
import {
  chooseMushafRenderer,
  chooseMushafRewayah,
} from '@/components/sheets/rewayahSelection';
import {getRewayahShortLabel} from '@/utils/rewayahLabels';
import {localizeDigits} from '@/i18n/format';
import {flipX} from '@/utils/rtl';
import {moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';
import {Chevron, Separator, SwitchRow} from './OptionRows';
import {FadeInView} from './motion';
import {QuranText} from './QuranText';
import {REWAYAH_GROUPS} from './readingLayout';
import {
  ROW_INSET,
  ROW_MIN_HEIGHT,
  textAlpha,
  useOptionStyles,
} from './optionStyles';

type ScriptKey = 'dkV1' | 'dkV2' | 'indopak' | 'qcfV2';
const SCRIPTS: readonly {value: MushafRenderer; key: ScriptKey}[] = [
  {value: 'dk_v1', key: 'dkV1'},
  {value: 'dk_v2', key: 'dkV2'},
  {value: 'dk_indopak', key: 'indopak'},
  {value: 'qcf_v2', key: 'qcfV2'},
];
const SCRIPT_KEY: Record<MushafRenderer, ScriptKey> = {
  dk_v1: 'dkV1',
  dk_v2: 'dkV2',
  dk_indopak: 'indopak',
  qcf_v2: 'qcfV2',
};
const COMING_COUNT = ALL_REWAYAH_IDS.filter(id => !hasTextData(id)).length;

/** The row that opens the Mushaf text screen: "script · rewayah". */
export function MushafTextRow({
  onPress,
}: {
  onPress: () => void;
}): React.JSX.Element {
  const styles = useOptionStyles();
  const {t} = useTranslation(['sheets', 'settings']);
  const renderer = useMushafSettingsStore(s => s.mushafRenderer);
  const rewayah = useMushafSettingsStore(s => s.rewayah);
  const summary = t('sheets:mushafOptions.mushafText.summary', {
    script: t(`settings:mushafSettings.fonts.${SCRIPT_KEY[renderer]}.label`),
    rewayah: getRewayahShortLabel(rewayah),
  });
  return (
    <View style={[styles.card, styles.section]}>
      <Pressable
        onPress={onPress}
        style={({pressed}) => [styles.row, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('sheets:mushafOptions.mushafText.title')}
        accessibilityValue={{text: summary}}
        testID="mushaf-options-mushaf-text">
        <View style={styles.texts}>
          <Text style={styles.title}>
            {t('sheets:mushafOptions.mushafText.title')}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {summary}
          </Text>
        </View>
        <Chevron />
      </Pressable>
    </View>
  );
}

/**
 * The pushed Mushaf text screen: the script, each drawn in its own font,
 * and the rewayah, grouped by qari. Off Hafs it adds Show differences with
 * its legend; Mushaf 1440 locks the rewayah to Hafs.
 */
export function MushafTextScreen({
  onBack,
  ScrollComponent,
  bottomPadding,
}: {
  onBack: () => void;
  ScrollComponent: React.ComponentType<ScrollViewProps>;
  bottomPadding: number;
}): React.JSX.Element {
  const styles = useOptionStyles();
  const {theme} = useTheme();
  const local = useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation(['sheets', 'settings']);
  const renderer = useMushafSettingsStore(s => s.mushafRenderer);
  const rewayah = useMushafSettingsStore(s => s.rewayah);
  const showDiffs = useMushafSettingsStore(s => s.showRewayahDiffs);
  const toggleDiffs = useMushafSettingsStore(s => s.toggleRewayahDiffs);
  const isQcf = renderer === 'qcf_v2';
  const hafs = rewayah === 'hafs';
  const rewayahName = getRewayahShortLabel(rewayah);

  // Mushaf 1440 is Hafs only: chooseMushafRenderer moves the text to Hafs
  // first and keeps the font (with a toast) when Hafs cannot load. The
  // beta alert follows a switch into it, as in Settings.
  const chooseScript = useCallback(
    async (value: MushafRenderer) => {
      const switchingToQcf =
        value === 'qcf_v2' &&
        useMushafSettingsStore.getState().mushafRenderer !== 'qcf_v2';
      const outcome = await chooseMushafRenderer(value);
      if (switchingToQcf && outcome.kind === 'switched') {
        Alert.alert(
          t('settings:mushafSettings.qcfBetaTitle'),
          t('settings:mushafSettings.qcfBetaMessage', {
            appName: branding.appName,
          }),
        );
      }
    },
    [t],
  );

  const chooseRewayah = useCallback((value: RewayahId) => {
    // The store refuses another rewayah under Mushaf 1440, so a tap must
    // not move the data service on its own either.
    if (useMushafSettingsStore.getState().mushafRenderer === 'qcf_v2') return;
    chooseMushafRewayah(value);
  }, []);

  return (
    <ScrollComponent
      style={local.scroll}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[local.content, {paddingBottom: bottomPadding}]}>
      <Pressable
        onPress={onBack}
        style={({pressed}) => [local.back, pressed && styles.pressed]}
        accessibilityRole="button"
        hitSlop={8}
        testID="mushaf-options-back">
        <Feather
          name="chevron-left"
          size={moderateScale(20)}
          color={theme.colors.text}
          style={flipX}
        />
        <Text style={local.backText}>
          {t('sheets:mushafOptions.mushafText.back')}
        </Text>
      </Pressable>
      <Text style={[styles.sheetTitle, local.title]} accessibilityRole="header">
        {t('sheets:mushafOptions.mushafText.title')}
      </Text>

      <View style={styles.section}>
        <Text style={styles.header} accessibilityRole="header">
          {t('sheets:mushafOptions.mushafText.scriptHeader')}
        </Text>
        <View style={styles.card} accessibilityRole="radiogroup">
          {SCRIPTS.map((script, index) => {
            const selected = renderer === script.value;
            // IndoPak's font lacks marks every other rewayah uses.
            const hafsOnly = script.value === 'dk_indopak' && !hafs;
            return (
              <React.Fragment key={script.value}>
                {index > 0 ? <Separator /> : null}
                <Pressable
                  onPress={() => chooseScript(script.value)}
                  disabled={hafsOnly}
                  style={({pressed}) => [
                    styles.row,
                    pressed && styles.pressed,
                    hafsOnly && styles.disabled,
                  ]}
                  accessibilityRole="radio"
                  accessibilityLabel={t(
                    `settings:mushafSettings.fonts.${script.key}.label`,
                  )}
                  accessibilityState={{checked: selected, disabled: hafsOnly}}
                  testID={`mushaf-options-script-${script.value}`}>
                  <View style={styles.texts}>
                    <View style={local.nameRow}>
                      <Text style={styles.title}>
                        {t(`settings:mushafSettings.fonts.${script.key}.label`)}
                      </Text>
                      {script.value === 'qcf_v2' ? (
                        <Text style={local.badge}>
                          {t('sheets:mushafOptions.mushafText.beta')}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.subtitle}>
                      {hafsOnly
                        ? t('settings:mushafSettings.hafsOnlyFont', {
                            rewayah: rewayahName,
                          })
                        : t(
                            `sheets:mushafOptions.mushafText.scripts.${script.key}`,
                          )}
                    </Text>
                    {/* Each script draws the basmala in its own face.
                        Mushaf 1440 has no Digital Khatt face of its own
                        and shows Madani 1421's, as the reader's text
                        surfaces do. */}
                    <QuranText
                      verseKey="1:1"
                      rewayah="hafs"
                      fontFamily={getDkFontFamily(script.value, 'hafs')}
                      fontSize={moderateScale(19)}
                      color={theme.colors.text}
                    />
                  </View>
                  <Feather
                    name="check"
                    size={moderateScale(20)}
                    color={theme.colors.text}
                    style={!selected && local.hidden}
                  />
                </Pressable>
              </React.Fragment>
            );
          })}
        </View>
        {renderer === 'dk_indopak' ? (
          <Text style={styles.helper}>
            {t('settings:mushafSettings.indopakHafsOnly', {
              font: REWAYAH_FALLBACK_RENDERER_LABEL,
            })}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.header} accessibilityRole="header">
          {t('sheets:mushafOptions.mushafText.rewayahHeader')}
        </Text>
        {!isQcf && hasDiffData(rewayah) ? (
          <FadeInView style={local.diffCard}>
            <DifferencesCard
              rewayah={rewayah}
              value={showDiffs}
              onValueChange={toggleDiffs}
            />
          </FadeInView>
        ) : null}
        {isQcf ? (
          <Text style={[styles.subtitle, local.locked]}>
            {t('sheets:mushafOptions.mushafText.rewayahLocked')}
          </Text>
        ) : null}
        <View style={styles.card} accessibilityRole="radiogroup">
          {REWAYAH_GROUPS.map(group => (
            <View key={group.qari}>
              <Text style={local.group}>
                {t(`sheets:mushafOptions.mushafText.qurra.${group.qari}`)}
              </Text>
              {group.rewayat.map(id => {
                const selected = rewayah === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => chooseRewayah(id)}
                    disabled={isQcf}
                    style={({pressed}) => [
                      local.option,
                      pressed && styles.pressed,
                      isQcf && !selected && styles.disabled,
                    ]}
                    accessibilityRole="radio"
                    accessibilityLabel={getLongLabel(id)}
                    accessibilityState={{checked: selected, disabled: isQcf}}
                    testID={`mushaf-options-rewayah-${id}`}>
                    <Text style={[styles.title, local.optionText]}>
                      {getLongLabel(id)}
                    </Text>
                    <Feather
                      name="check"
                      size={moderateScale(20)}
                      color={theme.colors.text}
                      style={!selected && local.hidden}
                    />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <Text style={styles.helper}>
          {t('sheets:mushafOptions.mushafText.moreComing', {
            number: localizeDigits(COMING_COUNT),
          })}
        </Text>
        <Text style={styles.helper}>
          {t('sheets:mushafOptions.mushafText.about')}
        </Text>
      </View>
    </ScrollComponent>
  );
}

/** Show differences from Hafs, with the colors it uses. */
function DifferencesCard({
  rewayah,
  value,
  onValueChange,
}: {
  rewayah: RewayahWithDiffs;
  value: boolean;
  onValueChange: (value: boolean) => void;
}): React.JSX.Element {
  const styles = useOptionStyles();
  const {theme} = useTheme();
  const local = useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation(['sheets', 'settings']);
  const legend = useMemo(() => getRewayahDiffLegend(rewayah), [rewayah]);
  return (
    <View style={styles.card}>
      <SwitchRow
        title={t('sheets:mushafOptions.mushafText.differences')}
        subtitle={t(
          `sheets:mushafOptions.mushafText.differencesHelp.${legend.summaryKey}`,
        )}
        value={value}
        onValueChange={onValueChange}
        testID="mushaf-options-differences"
      />
      {legend.entries.length > 0 ? (
        <View style={local.diffLegend}>
          {legend.entries.map(entry => (
            <View key={entry.key} style={local.diffEntry}>
              <View
                style={[
                  local.diffDot,
                  entry.isBackground && local.diffBlock,
                  {backgroundColor: entry.color},
                ]}
              />
              <Text style={local.diffLabel}>
                {t(`settings:mushafSettings.legendV2.labels.${entry.key}`)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(theme: Theme) {
  const small = theme.typography.smallSize;
  return StyleSheet.create({
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: moderateScale(16),
    },
    back: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: moderateScale(2),
      minHeight: moderateScale(36),
      paddingEnd: moderateScale(8),
      borderRadius: moderateScale(10),
    },
    backText: {
      fontSize: theme.typography.mediumSize,
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    title: {
      marginTop: moderateScale(6),
      marginBottom: moderateScale(14),
      marginStart: moderateScale(6),
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(8),
    },
    badge: {
      fontSize: theme.typography.captionSize,
      fontFamily: 'Manrope-Bold',
      color: textAlpha(theme, 0.7),
      backgroundColor: textAlpha(theme, 0.08),
      borderRadius: moderateScale(6),
      paddingHorizontal: moderateScale(7),
      paddingVertical: 2,
      overflow: 'hidden',
    },
    hidden: {
      opacity: 0,
    },
    diffCard: {
      marginBottom: moderateScale(10),
    },
    diffLegend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: moderateScale(16),
      paddingHorizontal: ROW_INSET,
      paddingBottom: moderateScale(14),
    },
    diffEntry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(6),
    },
    diffDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    diffBlock: {
      borderRadius: 3,
    },
    diffLabel: {
      fontSize: small,
      fontFamily: 'Manrope-Medium',
      color: textAlpha(theme, 0.8),
    },
    locked: {
      marginHorizontal: ROW_INSET,
      marginBottom: moderateScale(10),
    },
    group: {
      textAlign: 'left',
      fontSize: small,
      fontFamily: 'Manrope-SemiBold',
      color: textAlpha(theme, 0.55),
      paddingHorizontal: ROW_INSET,
      paddingTop: moderateScale(12),
      paddingBottom: moderateScale(2),
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(12),
      minHeight: ROW_MIN_HEIGHT,
      paddingHorizontal: ROW_INSET,
    },
    optionText: {
      flex: 1,
      fontFamily: 'Manrope-Medium',
    },
  });
}
