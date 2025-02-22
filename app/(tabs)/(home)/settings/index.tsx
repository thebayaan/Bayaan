import React from 'react';
import {Text, TouchableOpacity, ScrollView, View, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme, ThemeMode, PrimaryColor} from '@/utils/themeUtils';
import {Icon} from '@rneui/base';
import {Button} from '@/components/Button';
import {signOut} from '@/services/auth';
import {ScreenHeader} from '@/components/ScreenHeader';
import {primaryColors} from '@/styles/colorSchemes';
import {useAuthStore} from '@/store/authStore';
import {clearPlayerCache} from '@/services/player/utils/storage';

const formatColorName = (colorName: string): string => {
  return colorName
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const themeOptions: {label: string; value: ThemeMode}[] = [
  {label: 'System', value: 'system'},
  {label: 'Light', value: 'light'},
  {label: 'Dark', value: 'dark'},
];

const settingsItems = [
  {title: 'Default Reciter', type: 'defaultReciter'},
  {title: 'Reciter Choice', type: 'reciterChoice'},
  {title: 'Clear Cache', type: 'clearCache'},
];

export default function SettingsScreen() {
  const router = useRouter();
  const {theme, themeMode, setThemeMode, primaryColor, setPrimaryColor} =
    useTheme();
  const {isSigningOut, setSigningOut} = useAuthStore();
  const styles = createStyles(theme);

  const handleLogout = async () => {
    try {
      setSigningOut(true);
      const {success, error} = await signOut();

      if (!success) {
        console.error('Logout failed:', error);
        return;
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setSigningOut(false);
    }
  };

  const handleSettingPress = async (type: string) => {
    switch (type) {
      case 'defaultReciter':
        router.push('/settings/default-reciter');
        break;
      case 'reciterChoice':
        router.push('/settings/reciter-choice');
        break;
      case 'clearCache':
        Alert.alert(
          'Clear Cache',
          'This will clear all cached data including player state, recent tracks, and settings. Are you sure?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Clear',
              style: 'destructive',
              onPress: async () => {
                try {
                  await clearPlayerCache();
                  Alert.alert('Success', 'Cache cleared successfully');
                } catch (error) {
                  console.error('Error clearing cache:', error);
                  Alert.alert(
                    'Error',
                    'Failed to clear cache. Please try again.',
                  );
                }
              },
            },
          ],
        );
        break;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme</Text>
          <View style={styles.themeContainer}>
            {themeOptions.map(option => (
              <TouchableOpacity
                activeOpacity={0.99}
                key={option.value}
                style={[
                  styles.themeOption,
                  themeMode === option.value && styles.selectedThemeOption,
                ]}
                onPress={() => setThemeMode(option.value)}>
                <Text
                  style={[
                    styles.themeOptionText,
                    themeMode === option.value &&
                      styles.selectedThemeOptionText,
                  ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.section, styles.colorSection]}>
          <Text style={styles.sectionTitle}>Color</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.colorScrollContent}>
            {Object.entries(primaryColors).map(([color, value]) => (
              <View key={color} style={styles.colorOptionContainer}>
                <TouchableOpacity
                  activeOpacity={0.99}
                  style={[
                    styles.colorOption,
                    {backgroundColor: value},
                    primaryColor === color && styles.selectedColorOption,
                  ]}
                  onPress={() => setPrimaryColor(color as PrimaryColor)}
                />
                <Text
                  style={[
                    styles.colorLabel,
                    primaryColor === color && styles.selectedColorLabel,
                  ]}>
                  {formatColorName(color)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Other Settings</Text>
          {settingsItems.map((item, index) => (
            <TouchableOpacity
              activeOpacity={0.99}
              key={index}
              style={styles.settingItem}
              onPress={() => handleSettingPress(item.type)}>
              <Text style={styles.settingTitle}>{item.title}</Text>
              <Icon
                name="chevron-right"
                type="feather"
                color={theme.colors.textSecondary}
                size={moderateScale(20)}
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.logoutButtonContainer}>
        <Button
          title="Logout"
          onPress={handleLogout}
          loading={isSigningOut}
          disabled={isSigningOut}
          style={styles.logoutButton}
          textStyle={styles.logoutButtonText}
          size="medium"
        />
      </View>
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
    section: {
      marginBottom: moderateScale(30),
    },
    sectionTitle: {
      fontSize: moderateScale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: moderateScale(15),
    },
    themeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: moderateScale(10),
    },
    themeOption: {
      flex: 1,
      padding: moderateScale(12),
      borderRadius: moderateScale(12),
      backgroundColor: theme.colors.card,
      alignItems: 'center',
    },
    selectedThemeOption: {
      backgroundColor: theme.colors.textSecondary,
    },
    themeOptionText: {
      fontSize: moderateScale(14),
      color: theme.colors.text,
      fontWeight: '500',
    },
    selectedThemeOptionText: {
      color: theme.colors.background,
    },
    colorSection: {
      marginBottom: moderateScale(30),
    },
    colorScrollContent: {
      paddingHorizontal: moderateScale(4),
      gap: moderateScale(12),
    },
    colorOptionContainer: {
      alignItems: 'center',
      width: moderateScale(50),
    },
    colorOption: {
      width: moderateScale(40),
      height: moderateScale(40),
      borderRadius: moderateScale(12),
      borderWidth: moderateScale(2),
      borderColor: 'transparent',
      marginBottom: moderateScale(8),
      shadowColor: theme.colors.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 3,
    },
    selectedColorOption: {
      borderColor: theme.colors.text,
      shadowOpacity: 0.4,
      shadowRadius: 4.65,
      elevation: 6,
    },
    colorLabel: {
      fontSize: moderateScale(10),
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    selectedColorLabel: {
      color: theme.colors.text,
      fontWeight: '500',
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
      fontFamily: theme.fonts.bold,
      fontSize: moderateScale(16),
    },
  });
