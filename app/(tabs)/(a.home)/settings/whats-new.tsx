import React from 'react';
import {View, Text, ScrollView} from 'react-native';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Header from '@/components/Header';
import {ChangelogContent} from '@/components/changelog/ChangelogContent';
import changelogData from '@/data/changelog.json';
import {ChangelogEntry} from '@/types/changelog';

export default function WhatsNewScreen() {
  const {theme} = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);

  // Get the latest changelog entry
  const latestChangelog =
    changelogData.length > 0 ? (changelogData[0] as ChangelogEntry) : null;

  if (!latestChangelog) {
    return (
      <View style={styles.container}>
        <Header title="What's New" onBack={() => router.back()} />
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, {color: theme.colors.textSecondary}]}>
            No changelog available
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="What's New" onBack={() => router.back()} />
      <View
        style={[styles.content, {paddingTop: insets.top + moderateScale(56)}]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <ChangelogContent
            changelog={latestChangelog}
            showVersion={true}
            showFullDetails={false}
          />
        </ScrollView>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: moderateScale(24),
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: moderateScale(160),
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.regular,
    },
  });
