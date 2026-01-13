import React, {useEffect} from 'react';
import {ScrollView, Text, View, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Header from '@/components/Header';
import {ChangelogItem} from '@/components/changelog/ChangelogItem';
import {useChangelogStore} from '@/store/changelogStore';
import changelogData from '@/data/CHANGELOG.json';
import {ChangelogData} from '@/types/changelog';
import Constants from 'expo-constants';

const typedChangelogData = changelogData as ChangelogData;

export default function ChangelogScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const {markChangelogAsRead} = useChangelogStore();
  const styles = createStyles(theme);

  // Get current app version
  const currentVersion =
    Constants.expoConfig?.extra?.version?.semanticVersion || '1.1.3';

  useEffect(() => {
    // Mark changelog as read when user views it
    markChangelogAsRead(currentVersion);
  }, [currentVersion, markChangelogAsRead]);

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <Header title="What's New" showBackButton />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          {paddingBottom: insets.bottom + moderateScale(20)},
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={[styles.title, {color: theme.colors.text}]}>
            Changelog
          </Text>
          <Text style={[styles.subtitle, {color: theme.colors.textSecondary}]}>
            Track all improvements and changes to Bayaan
          </Text>
        </View>

        {/* Version List */}
        {typedChangelogData.versions.map((version, index) => (
          <ChangelogItem
            key={version.version}
            version={version}
            categories={typedChangelogData.categories}
            theme={theme}
            index={index}
          />
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, {color: theme.colors.textSecondary}]}>
            Using version {currentVersion}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingTop: moderateScale(8),
    },
    headerSection: {
      paddingHorizontal: moderateScale(16),
      marginBottom: moderateScale(20),
    },
    title: {
      fontSize: moderateScale(32),
      fontWeight: 'bold',
      marginBottom: moderateScale(8),
    },
    subtitle: {
      fontSize: moderateScale(15),
      lineHeight: moderateScale(20),
    },
    footer: {
      alignItems: 'center',
      paddingVertical: moderateScale(24),
    },
    footerText: {
      fontSize: moderateScale(13),
    },
  });
