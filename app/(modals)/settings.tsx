import React, {useState, useEffect} from 'react';
import {View, Text, ScrollView, TouchableOpacity, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Icon} from '@rneui/themed';
import {useTheme} from '@/hooks/useTheme';
import {PrimaryColor} from '@/utils/themeUtils';
import {primaryColors} from '@/styles/colorSchemes';
import {Button} from '@/components/Button';
import {useAuthStore} from '@/store/authStore';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {Theme} from '@/styles/theme';
import {SettingItemModal} from '@/components/SettingItemModal';

const DOWNLOAD_QUALITY_KEY = 'download_quality';
const LANGUAGE_KEY = 'app_language';

export default function SettingsModal() {
  const router = useRouter();
  const {themeMode, setThemeMode, theme, primaryColor, setPrimaryColor} =
    useTheme();
  const styles = createStyles(theme);
  const {session, signOut} = useAuthStore();

  const [downloadQuality, setDownloadQuality] = useState('high');
  const [language, setLanguage] = useState('en');
  const [defaultReciter, setDefaultReciter] = useState<string | null>(null);
  const [currentSetting, setCurrentSetting] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const storedQuality = await AsyncStorage.getItem(DOWNLOAD_QUALITY_KEY);
    if (storedQuality) setDownloadQuality(storedQuality);

    const storedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (storedLanguage) setLanguage(storedLanguage);

    const storedDefaultReciter = await AsyncStorage.getItem('default_reciter');
    if (storedDefaultReciter) {
      const reciter = JSON.parse(storedDefaultReciter);
      setDefaultReciter(reciter.name);
    }
  };

  const handleDownloadQualityChange = async (quality: string) => {
    setDownloadQuality(quality);
    await AsyncStorage.setItem(DOWNLOAD_QUALITY_KEY, quality);
  };

  const handleLanguageChange = async (lang: string) => {
    setLanguage(lang);
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  };

  const handleLogout = async () => {
    try {
      const {success, error} = await signOut();
      if (success) {
        router.replace('/welcome');
      } else {
        console.error('Error logging out:', error);
        Alert.alert('Logout Failed', 'An error occurred while logging out.');
      }
    } catch (error) {
      console.error('Error during logout:', error);
      Alert.alert('Logout Failed', 'An unexpected error occurred.');
    }
  };

  const renderSettingItem = (
    title: string,
    value: string | boolean,
    onPress: () => void,
    iconName: string,
  ) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingItemLeft}>
        <Icon
          name={iconName}
          type="ionicon"
          size={24}
          color={theme.colors.text}
          style={{marginRight: theme.spacing.unit}}
        />
        <Text style={styles.settingTitle}>{title}</Text>
      </View>
      <Text style={styles.settingValue}>{value}</Text>
    </TouchableOpacity>
  );

  const renderSettingOptions = () => {
    switch (currentSetting) {
      case 'theme':
        return (
          <SettingItemModal
            title="Theme"
            options={[
              {
                label: 'Light',
                value: 'light',
                onPress: () => setThemeMode('light'),
              },
              {
                label: 'Dark',
                value: 'dark',
                onPress: () => setThemeMode('dark'),
              },
              {
                label: 'System',
                value: 'system',
                onPress: () => setThemeMode('system'),
              },
            ]}
            onClose={() => setCurrentSetting(null)}
          />
        );
      case 'primaryColor':
        return (
          <SettingItemModal
            title="Primary Color"
            options={Object.keys(primaryColors).map(color => ({
              label: color,
              value: color,
              onPress: () => setPrimaryColor(color as PrimaryColor),
            }))}
            onClose={() => setCurrentSetting(null)}
          />
        );
      case 'downloadQuality':
        return (
          <SettingItemModal
            title="Download Quality"
            options={[
              {
                label: 'Low',
                value: 'Low',
                onPress: () => handleDownloadQualityChange('Low'),
              },
              {
                label: 'Medium',
                value: 'Medium',
                onPress: () => handleDownloadQualityChange('Medium'),
              },
              {
                label: 'High',
                value: 'High',
                onPress: () => handleDownloadQualityChange('High'),
              },
            ]}
            onClose={() => setCurrentSetting(null)}
          />
        );
      case 'language':
        return (
          <SettingItemModal
            title="Language"
            options={[
              {
                label: 'English',
                value: 'en',
                onPress: () => handleLanguageChange('en'),
              },
              {
                label: 'العربية',
                value: 'ar',
                onPress: () => handleLanguageChange('ar'),
              },
            ]}
            onClose={() => setCurrentSetting(null)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeButton}>
          <Icon
            name="close"
            type="ionicon"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>
      {currentSetting ? (
        renderSettingOptions()
      ) : (
        <ScrollView style={styles.scrollContainer}>
          {renderSettingItem(
            'Theme',
            themeMode === 'system'
              ? 'System'
              : themeMode === 'dark'
                ? 'Dark'
                : 'Light',
            () => router.push('/setting-item-playground?type=theme'),
            'color-palette',
          )}
          {renderSettingItem(
            'Primary Color',
            primaryColor,
            () => router.push('/setting-item-playground?type=primaryColor'),
            'color-filter',
          )}
          {renderSettingItem(
            'Download Quality',
            downloadQuality,
            () => router.push('/setting-item-playground?type=downloadQuality'),
            'download',
          )}
          {renderSettingItem(
            'Language',
            language === 'en' ? 'English' : 'العربية',
            () => router.push('/setting-item-playground?type=language'),
            'language',
          )}
          {renderSettingItem(
            'Default Reciter',
            defaultReciter || 'Not set',
            () => router.push('/setting-item-playground?type=defaultReciter'),
            'person',
          )}
          {renderSettingItem(
            'About',
            '',
            () => router.push('/setting-item-playground?type=about'),
            'information-circle',
          )}
          {renderSettingItem(
            'Privacy Policy',
            '',
            () => router.push('/setting-item-playground?type=privacyPolicy'),
            'shield-checkmark',
          )}
          {session && (
            <View style={styles.accountSection}>
              <Text style={styles.accountEmail}>{session.user.email}</Text>
              <Button
                title="Log Out"
                onPress={handleLogout}
                style={styles.logoutButton}
                textColor={'#b00020'}
              />
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: moderateScale(15),
    },
    closeButton: {
      position: 'absolute',
      left: moderateScale(15),
      zIndex: 1,
    },
    headerTitle: {
      fontSize: moderateScale(24),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    placeholder: {
      width: moderateScale(32),
    },
    scrollContainer: {
      flex: 1,
      paddingHorizontal: moderateScale(15),
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: verticalScale(15),
    },
    settingItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    settingIcon: {
      marginRight: moderateScale(10),
    },
    settingTitle: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
      fontFamily: theme.fonts.regular,
    },
    settingValue: {
      fontSize: moderateScale(16),
      color: theme.colors.textSecondary,
      marginRight: moderateScale(10),
      fontFamily: theme.fonts.regular,
    },
    accountSection: {
      marginTop: verticalScale(30),
      alignItems: 'center',
    },
    accountEmail: {
      fontSize: moderateScale(16),
      color: theme.colors.textSecondary,
      marginBottom: verticalScale(15),
      fontFamily: theme.fonts.regular,
    },
    logoutButton: {
      backgroundColor: theme.colors.background,
      borderWidth: moderateScale(0.8),
      borderRadius: moderateScale(20),
      borderColor: '#b00020',
      width: '50%',
    },
  });
