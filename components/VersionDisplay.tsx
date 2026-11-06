import React from 'react';
import {Text, StyleSheet, StyleProp, TextStyle} from 'react-native';
import {
  getVersionString,
  getFullVersionString,
  getBuildTypeLabel,
} from '@/utils/appVersion';
import {useTheme} from '@/hooks/useTheme';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end

interface VersionDisplayProps {
  showBuildNumber?: boolean;
  showBuildType?: boolean;
  style?: StyleProp<TextStyle>;
}

// @ai-start
export const VersionDisplay: React.FC<VersionDisplayProps> = ({
  showBuildNumber = false,
  showBuildType = false,
  style,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation('settings');

  const versionText = showBuildNumber
    ? getFullVersionString()
    : getVersionString();

  const buildTypeLabel = showBuildType ? getBuildTypeLabel() : '';

  return (
    <Text
      style={[styles.versionText, {color: theme.colors.textSecondary}, style]}>
      {buildTypeLabel
        ? t('version.withBuildType', {
            version: versionText,
            buildType: buildTypeLabel,
          })
        : t('version.label', {version: versionText})}
    </Text>
  );
};
// @ai-end

const styles = StyleSheet.create({
  versionText: {
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
  },
});
