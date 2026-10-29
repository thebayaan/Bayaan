import React from 'react';
import {View, Text, ScrollView} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {Theme} from '@/utils/themeUtils';
import {ChangelogContent} from '@/components/changelog/ChangelogContent';
import changelogData from '@/data/changelog.json';
import {ChangelogEntry} from '@/types/changelog';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end

// @ai-start
export default function WhatsNewScreen() {
  const {theme} = useTheme();
  const {t} = useTranslation('settings');
  const styles = createStyles(theme);

  // Get the latest changelog entry
  const latestChangelog =
    changelogData.length > 0 ? (changelogData[0] as ChangelogEntry) : null;

  if (!latestChangelog) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, {color: theme.colors.textSecondary}]}>
            {t('whatsNew.empty')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}>
          <ChangelogContent
            changelog={latestChangelog}
            showVersion={true}
            showFullDetails={true}
          />
        </ScrollView>
      </View>
    </View>
  );
}
// @ai-end

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
