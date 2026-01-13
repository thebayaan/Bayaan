import React from 'react';
import {View, Text, StyleSheet, ScrollView, Image} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Icon} from '@rneui/base';
import Color from 'color';
import {ChangelogEntry} from '@/types/changelog';

interface ChangelogContentProps {
  changelog: ChangelogEntry;
  showVersion?: boolean;
  showFullDetails?: boolean;
}

export function ChangelogContent({
  changelog,
  showVersion = true,
  showFullDetails = false,
}: ChangelogContentProps) {
  const {theme} = useTheme();

  const sectionConfig = [
    {key: 'features', title: 'New Features', icon: '✨'},
    {key: 'improvements', title: 'Improvements', icon: '⚡'},
    {key: 'fixes', title: 'Bug Fixes', icon: '🔧'},
  ];

  return (
    <ScrollView
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}>
      {showVersion && (
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.logo}
          />
          <Text style={[styles.version, {color: theme.colors.textSecondary}]}>
            Version {changelog.version} · {formatDate(changelog.releaseDate)}
          </Text>
        </View>
      )}

      <View style={styles.highlightsContainer}>
        {changelog.highlights.map((highlight, index) => (
          <View key={index} style={styles.highlightCard}>
            <Icon
              name={highlight.icon}
              type="ionicon"
              size={moderateScale(26)}
              color={theme.colors.text}
            />
            <View style={styles.highlightTextContainer}>
              <Text style={[styles.highlightTitle, {color: theme.colors.text}]}>
                {highlight.title}
              </Text>
              <Text
                style={[
                  styles.highlightDescription,
                  {color: theme.colors.textSecondary},
                ]}>
                {highlight.description}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {showFullDetails && changelog.fullChangelog && (
        <View style={styles.fullChangelogContainer}>
          {sectionConfig.map(
            section =>
              changelog.fullChangelog?.[
                section.key as keyof typeof changelog.fullChangelog
              ] &&
              (
                changelog.fullChangelog[
                  section.key as keyof typeof changelog.fullChangelog
                ] || []
              ).length > 0 && (
                <View key={section.key} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionIcon}>{section.icon}</Text>
                    <Text
                      style={[styles.sectionTitle, {color: theme.colors.text}]}>
                      {section.title}
                    </Text>
                  </View>
                  {(
                    changelog.fullChangelog[
                      section.key as keyof typeof changelog.fullChangelog
                    ] || []
                  ).map((item, index) => (
                    <View key={index} style={styles.listItem}>
                      <View
                        style={[
                          styles.bullet,
                          {
                            backgroundColor: Color(theme.colors.text)
                              .alpha(0.3)
                              .toString(),
                          },
                        ]}
                      />
                      <Text
                        style={[styles.listText, {color: theme.colors.text}]}>
                        {item}
                      </Text>
                    </View>
                  ))}
                </View>
              ),
          )}
        </View>
      )}
    </ScrollView>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return date.toLocaleDateString('en-US', options);
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: moderateScale(20),
  },
  header: {
    alignItems: 'center',
    marginBottom: moderateScale(32),
  },
  logo: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(16),
    marginBottom: moderateScale(12),
  },
  title: {
    fontSize: moderateScale(24),
    fontFamily: 'Manrope-Bold',
    textAlign: 'center',
    marginBottom: moderateScale(8),
  },
  version: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Regular',
  },
  highlightsContainer: {
    marginBottom: moderateScale(24),
    gap: moderateScale(16),
  },
  sectionTitle: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-SemiBold',
    marginBottom: moderateScale(12),
  },
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: moderateScale(12),
    gap: moderateScale(14),
  },
  highlightTextContainer: {
    flex: 1,
  },
  highlightTitle: {
    fontSize: moderateScale(17),
    fontFamily: 'Manrope-Bold',
    marginBottom: moderateScale(4),
  },
  highlightDescription: {
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-Regular',
    lineHeight: moderateScale(18),
    opacity: 0.7,
  },
  fullChangelogContainer: {
    gap: moderateScale(24),
  },
  section: {
    marginBottom: moderateScale(8),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(12),
  },
  sectionIcon: {
    fontSize: moderateScale(18),
    marginRight: moderateScale(8),
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: moderateScale(8),
    paddingLeft: moderateScale(8),
  },
  bullet: {
    width: moderateScale(5),
    height: moderateScale(5),
    borderRadius: moderateScale(2.5),
    marginTop: moderateScale(8),
    marginRight: moderateScale(12),
  },
  listText: {
    flex: 1,
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Regular',
    lineHeight: moderateScale(20),
  },
});
