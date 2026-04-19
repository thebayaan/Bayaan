import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {TopTabBar} from '../components/nav/TopTabBar';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {typography} from '../theme/typography';

export function CollectionScreen(): React.ReactElement {
  return (
    <View style={styles.container}>
      <TopTabBar />
      <View style={styles.center}>
        <Text style={styles.title}>Your playlists will appear here</Text>
        <Text style={styles.sub}>
          Create playlists in the Bayaan mobile app. They&apos;ll sync to your
          TV once playlist sync ships.
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
  },
  title: {
    color: colors.text,
    ...typography.heading,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  sub: {
    color: colors.textSecondary,
    ...typography.body,
    textAlign: 'center',
    maxWidth: 600,
  },
});
