import React from 'react';
import {Text, StyleSheet, StyleProp, TextStyle} from 'react-native';
import {getVersionString, getFullVersionString, getBuildTypeLabel} from '@/utils/appVersion';
import {useTheme} from '@/hooks/useTheme';

interface VersionDisplayProps {
  showBuildNumber?: boolean;
  showBuildType?: boolean;
  style?: StyleProp<TextStyle>;
}

export const VersionDisplay: React.FC<VersionDisplayProps> = ({
  showBuildNumber = false,
  showBuildType = false,
  style,
}) => {
  const {theme} = useTheme();
  
  const versionText = showBuildNumber 
    ? getFullVersionString()
    : getVersionString();
    
  const buildTypeLabel = showBuildType ? getBuildTypeLabel() : '';
  
  return (
    <Text style={[styles.versionText, {color: theme.colors.textSecondary}, style]}>
      Version {versionText}
      {buildTypeLabel ? ` - ${buildTypeLabel}` : ''}
    </Text>
  );
};

const styles = StyleSheet.create({
  versionText: {
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
  },
}); 