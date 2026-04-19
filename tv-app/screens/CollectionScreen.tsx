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
      <View style={styles.center}>
        <View style={styles.iconHalo}>
          <PlaylistIcon color={colors.text} size={72} />
        </View>
        <Text style={styles.title}>Your Collection</Text>
        <Text style={styles.sub}>
          Playlists and favorites you create on the Bayaan mobile app will
          appear here.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
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
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    ...typography.title,
    textAlign: 'center',
  },
  sub: {
    color: colors.textSecondary,
    ...typography.body,
    textAlign: 'center',
    maxWidth: 640,
    lineHeight: 28,
  },
});
