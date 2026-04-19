import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {colors} from '../../theme/colors';
import {spacing} from '../../theme/spacing';
import {useNavStore, type TabKey} from '../../store/navStore';
import {
  CollectionIcon,
  HomeIcon,
  ProfileIcon,
  SearchIcon,
  type IconProps,
} from '../../../components/Icons';

type TabEntry = {
  key: TabKey;
  label: string;
  icon: React.FC<IconProps>;
};

const TABS: TabEntry[] = [
  {key: 'home', label: 'Home', icon: HomeIcon},
  {key: 'search', label: 'Search', icon: SearchIcon},
  {key: 'collection', label: 'Collection', icon: CollectionIcon},
];

export function TopTabBar(): React.ReactElement {
  const current = useNavStore(s => s.currentTab);
  const switchTab = useNavStore(s => s.switchTab);

  return (
    <View style={styles.bar}>
      <View style={styles.brandWrap}>
        <Text style={styles.brand}>Bayaan</Text>
      </View>
      <View style={styles.center}>
        {TABS.map(t => {
          const active = current === t.key;
          const Icon = t.icon;
          return (
            <FocusableButton
              key={t.key}
              onPress={() => switchTab(t.key)}
              accessibilityLabel={t.label}
              style={styles.tab}>
              <View style={styles.tabInner}>
                <Icon color={colors.text} size={22} filled={active} />
                <Text style={[styles.tabText, active && styles.tabActive]}>
                  {t.label}
                </Text>
              </View>
            </FocusableButton>
          );
        })}
      </View>
      <View style={styles.settingsWrap}>
        <FocusableButton
          onPress={() => switchTab('settings')}
          accessibilityLabel="Settings"
          style={styles.settings}>
          <ProfileIcon
            color={colors.text}
            size={24}
            filled={current === 'settings'}
          />
        </FocusableButton>
      </View>
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
  brandWrap: {width: 180},
  brand: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  center: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  tab: {paddingHorizontal: spacing.md, paddingVertical: 10},
  tabInner: {flexDirection: 'row', alignItems: 'center', gap: 8},
  tabText: {color: colors.text, fontSize: 16, fontWeight: '500', opacity: 0.45},
  tabActive: {opacity: 1, fontWeight: '700'},
  settingsWrap: {width: 180, alignItems: 'flex-end'},
  settings: {padding: spacing.sm},
});
