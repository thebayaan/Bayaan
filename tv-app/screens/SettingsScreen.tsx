import React, {useState} from 'react';
import {ScrollView, Text, TVFocusGuideView, View} from 'react-native';
import {TopTabBar} from '../components/nav/TopTabBar';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusableCard} from '../components/primitives/FocusableCard';
import {CheckIcon, TrashIcon} from '../../components/Icons';
import {useReciters} from '../hooks/useReciters';
import {useContinueListening} from '../hooks/useContinueListening';
import {useFavorites} from '../hooks/useFavorites';
import {clearContinue} from '../services/continueListeningStore';
import {clearFavorites} from '../services/favoritesStore';
import {useSettingsStore} from '../store/settingsStore';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {fonts, typography} from '../theme/typography';
import {createScaledStyles, scale} from '../theme/scale';

type ConfirmKey = 'history' | 'favorites' | null;

export function SettingsScreen(): React.ReactElement {
  const {reciters} = useReciters();
  const defaultReciterId = useSettingsStore(s => s.defaultReciterId);
  const setDefaultReciterId = useSettingsStore(s => s.setDefaultReciterId);
  const continueEntries = useContinueListening();
  const favorites = useFavorites();
  const current = reciters.find(r => r.id === defaultReciterId);
  const [confirm, setConfirm] = useState<ConfirmKey>(null);

  function runClear(key: Exclude<ConfirmKey, null>): void {
    if (confirm !== key) {
      setConfirm(key);
      return;
    }
    if (key === 'history') clearContinue();
    else clearFavorites();
    setConfirm(null);
  }

  return (
    <View style={styles.container}>
      <TopTabBar />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>PROFILE</Text>
        <Text style={styles.pageTitle}>Settings</Text>

        <Text style={styles.sectionLabel}>Default Reciter</Text>
        <Text style={styles.currentValue}>
          {current?.name ?? 'Not set — pick one below'}
        </Text>
        <TVFocusGuideView autoFocus style={styles.grid}>
          {reciters.slice(0, 18).map((r, i) => {
            const selected = defaultReciterId === r.id;
            return (
              <FocusableCard
                key={r.id}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => setDefaultReciterId(r.id)}
                hasTVPreferredFocus={i === 0}>
                <View style={styles.chipInner}>
                  {selected && (
                    <CheckIcon color={colors.background} size={scale(16)} />
                  )}
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextActive,
                    ]}>
                    {r.name}
                  </Text>
                </View>
              </FocusableCard>
            );
          })}
        </TVFocusGuideView>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>
          Your Data
        </Text>
        <TVFocusGuideView autoFocus style={styles.dataRow}>
          <ClearButton
            label="Clear listening history"
            count={continueEntries.length}
            confirming={confirm === 'history'}
            onPress={() => runClear('history')}
          />
          <ClearButton
            label="Clear favorites"
            count={favorites.length}
            confirming={confirm === 'favorites'}
            onPress={() => runClear('favorites')}
          />
        </TVFocusGuideView>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>About</Text>
        <Text style={styles.aboutText}>Bayaan TV · v0.1.0</Text>
        <Text style={styles.aboutSub}>
          Quran recitations on your television, from the Bayaan team.
        </Text>
      </ScrollView>
    </View>
  );
}

type ClearButtonProps = {
  label: string;
  count: number;
  confirming: boolean;
  onPress: () => void;
};

function ClearButton({
  label,
  count,
  confirming,
  onPress,
}: ClearButtonProps): React.ReactElement {
  return (
    <FocusableButton
      onPress={onPress}
      accessibilityLabel={confirming ? `${label} — confirm` : label}
      style={[styles.clearBtn, confirming && styles.clearBtnConfirm]}>
      <View style={styles.clearInner}>
        <TrashIcon
          color={confirming ? colors.background : colors.text}
          size={scale(16)}
        />
        <View>
          <Text
            style={[styles.clearLabel, confirming && styles.clearLabelConfirm]}>
            {confirming ? 'Tap again to confirm' : label}
          </Text>
          {!confirming && count > 0 ? (
            <Text style={styles.clearMeta}>
              {count} {count === 1 ? 'item' : 'items'}
            </Text>
          ) : null}
        </View>
      </View>
    </FocusableButton>
  );
}

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: 4,
  },
  kicker: {
    color: colors.text,
    ...typography.label,
    opacity: 0.55,
    marginBottom: 6,
  },
  pageTitle: {
    color: colors.text,
    ...typography.title,
    letterSpacing: -0.5,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  sectionSpacer: {marginTop: spacing.xxl},
  currentValue: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 20,
    fontWeight: '500',
    marginBottom: spacing.md,
    opacity: 0.75,
  },
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingVertical: 6},
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 22,
  },
  chipActive: {backgroundColor: colors.text},
  chipInner: {flexDirection: 'row', alignItems: 'center', gap: 8},
  chipText: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 18,
    fontWeight: '600',
  },
  chipTextActive: {color: colors.background},
  dataRow: {flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap'},
  clearBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    minWidth: 300,
  },
  clearBtnConfirm: {backgroundColor: colors.text},
  clearInner: {flexDirection: 'row', alignItems: 'center', gap: 12},
  clearLabel: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 18,
    fontWeight: '700',
  },
  clearLabelConfirm: {color: colors.background},
  clearMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
    marginTop: 2,
  },
  aboutText: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 20,
    fontWeight: '500',
  },
  aboutSub: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 16,
    opacity: 0.7,
    marginTop: 4,
  },
});
