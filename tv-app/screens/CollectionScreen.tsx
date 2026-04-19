import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {TopTabBar} from '../components/nav/TopTabBar';
import {PlaylistIcon} from '../../components/Icons';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {typography} from '../theme/typography';

export function CollectionScreen(): React.ReactElement {
  return (
    <View style={styles.container}>
      <TopTabBar />
      <View style={styles.header}>
        <Text style={styles.kicker}>YOUR LIBRARY</Text>
        <Text style={styles.pageTitle}>Collection</Text>
      </View>
      <View style={styles.center}>
        <View style={styles.iconHalo}>
          <PlaylistIcon color={colors.text} size={72} />
        </View>
        <Text style={styles.title}>Coming from the mobile app</Text>
        <Text style={styles.sub}>
          Playlists and favorites you create on the Bayaan mobile app will
          appear here, ready for the big screen.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: 6,
  },
  kicker: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2.2,
    opacity: 0.55,
  },
  pageTitle: {
    color: colors.text,
    ...typography.title,
    letterSpacing: -0.5,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  iconHalo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  sub: {
    color: colors.textSecondary,
    ...typography.body,
    textAlign: 'center',
    maxWidth: 640,
    lineHeight: 28,
    opacity: 0.75,
  },
});
