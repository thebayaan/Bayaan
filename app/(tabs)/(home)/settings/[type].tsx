import React from 'react';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useLocalSearchParams} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {ScreenHeader} from '@/components/ScreenHeader';
import DefaultReciterSettings from '@/components/settings/DefaultReciterSettings';
import ReciterChoiceSettings from '@/components/settings/ReciterChoiceSettings';

export default function SettingScreen() {
  const {type} = useLocalSearchParams<{type: string}>();
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const renderSettingComponent = () => {
    switch (type) {
      case 'defaultReciter':
        return <DefaultReciterSettings />;
      case 'reciterChoice':
        return <ReciterChoiceSettings />;
      default:
        return null;
    }
  };

  const title = type
    ? type
        .split(/(?=[A-Z])/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    : 'Settings';

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={title} />
      {renderSettingComponent()}
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingHorizontal: moderateScale(20),
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: moderateScale(15),
    },
    settingTitle: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
    },
    logoutButtonContainer: {
      alignItems: 'center',
      marginBottom: moderateScale(50),
    },
    logoutButton: {
      backgroundColor: theme.colors.error,
      paddingHorizontal: moderateScale(20),
      borderRadius: moderateScale(30),
    },
    logoutButtonText: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: moderateScale(14),
    },
  });
