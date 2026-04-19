import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {colors} from '../../theme/colors';
import {spacing} from '../../theme/spacing';
import {typography} from '../../theme/typography';
import {useNavStore, type TabKey} from '../../store/navStore';

const TABS: {key: TabKey; label: string}[] = [
  {key: 'home', label: 'Home'},
  {key: 'search', label: 'Search'},
  {key: 'collection', label: 'Collection'},
];

export function TopTabBar(): React.ReactElement {
  const current = useNavStore(s => s.currentTab);
  const switchTab = useNavStore(s => s.switchTab);
  return (
    <View style={styles.bar}>
      <View style={styles.center}>
        {TABS.map(t => (
          <FocusableButton
            key={t.key}
            onPress={() => switchTab(t.key)}
            accessibilityLabel={t.label}
            style={styles.tab}>
            <Text
              style={[styles.tabText, current === t.key && styles.tabActive]}>
              {t.label}
            </Text>
          </FocusableButton>
        ))}
      </View>
      <FocusableButton
        onPress={() => switchTab('settings')}
        accessibilityLabel="Settings"
        style={styles.settings}>
        <Text style={styles.tabText}>⚙</Text>
      </FocusableButton>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  tab: {paddingHorizontal: spacing.sm, paddingVertical: 8},
  tabText: {color: colors.text, ...typography.caption, opacity: 0.45},
  tabActive: {opacity: 1, fontWeight: '700'},
  settings: {padding: spacing.sm},
});
