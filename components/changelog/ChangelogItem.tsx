import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {VersionInfo, ChangelogData} from '@/types/changelog';
import {CategoryBadge} from './CategoryBadge';
import {Theme} from '@/utils/themeUtils';
import {moderateScale} from 'react-native-size-matters';
import Animated, {FadeInDown} from 'react-native-reanimated';

interface ChangelogItemProps {
  version: VersionInfo;
  categories: ChangelogData['categories'];
  theme: Theme;
  index: number;
}

export const ChangelogItem: React.FC<ChangelogItemProps> = ({
  version,
  categories,
  theme,
  index,
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100)}
      style={[styles.container, {backgroundColor: theme.colors.surface}]}>
      {/* Version Header */}
      <View style={styles.header}>
        <View style={styles.versionInfo}>
          <Text style={[styles.versionNumber, {color: theme.colors.primary}]}>
            v{version.version}
          </Text>
          {index === 0 && (
            <View
              style={[
                styles.latestBadge,
                {backgroundColor: theme.colors.primary},
              ]}>
              <Text style={styles.latestText}>Latest</Text>
            </View>
          )}
        </View>
        <Text style={[styles.date, {color: theme.colors.textSecondary}]}>
          {formatDate(version.releaseDate)}
        </Text>
      </View>

      {/* Highlights */}
      {version.highlights.length > 0 && (
        <View style={styles.highlights}>
          {version.highlights.map((highlight, idx) => (
            <View key={idx} style={styles.highlightItem}>
              <Text
                style={[styles.highlightDot, {color: theme.colors.primary}]}>
                •
              </Text>
              <Text
                style={[styles.highlightText, {color: theme.colors.text}]}>
                {highlight}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Changes */}
      <View style={styles.changes}>
        {version.changes.map((change, idx) => {
          const categoryConfig = categories[change.category];
          return (
            <View key={idx} style={styles.changeItem}>
              <CategoryBadge
                category={change.category}
                icon={categoryConfig.icon}
                label={categoryConfig.label}
                color={categoryConfig.color}
                isDark={theme.mode === 'dark'}
              />
              <Text style={[styles.changeTitle, {color: theme.colors.text}]}>
                {change.title}
              </Text>
              <Text
                style={[
                  styles.changeDescription,
                  {color: theme.colors.textSecondary},
                ]}>
                {change.description}
              </Text>
              {change.platforms && change.platforms.length > 0 && (
                <View style={styles.platforms}>
                  {change.platforms.map((platform, pIdx) => (
                    <View
                      key={pIdx}
                      style={[
                        styles.platformBadge,
                        {
                          backgroundColor:
                            theme.mode === 'dark'
                              ? 'rgba(255,255,255,0.1)'
                              : 'rgba(0,0,0,0.05)',
                        },
                      ]}>
                      <Text
                        style={[
                          styles.platformText,
                          {color: theme.colors.textSecondary},
                        ]}>
                        {platform.toUpperCase()}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: moderateScale(16),
    marginBottom: moderateScale(16),
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    marginBottom: moderateScale(12),
  },
  versionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(4),
  },
  versionNumber: {
    fontSize: moderateScale(24),
    fontWeight: 'bold',
  },
  latestBadge: {
    marginLeft: moderateScale(8),
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(2),
    borderRadius: moderateScale(8),
  },
  latestText: {
    color: 'white',
    fontSize: moderateScale(10),
    fontWeight: '600',
  },
  date: {
    fontSize: moderateScale(13),
  },
  highlights: {
    marginBottom: moderateScale(16),
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: moderateScale(4),
  },
  highlightDot: {
    fontSize: moderateScale(16),
    marginRight: moderateScale(8),
    marginTop: moderateScale(2),
  },
  highlightText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    flex: 1,
  },
  changes: {
    gap: moderateScale(12),
  },
  changeItem: {
    gap: moderateScale(6),
  },
  changeTitle: {
    fontSize: moderateScale(15),
    fontWeight: '600',
  },
  changeDescription: {
    fontSize: moderateScale(13),
    lineHeight: moderateScale(18),
  },
  platforms: {
    flexDirection: 'row',
    gap: moderateScale(6),
    marginTop: moderateScale(4),
  },
  platformBadge: {
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(2),
    borderRadius: moderateScale(4),
  },
  platformText: {
    fontSize: moderateScale(9),
    fontWeight: '600',
  },
});
