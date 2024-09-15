import React from 'react';
import {View, Text, TouchableOpacity, ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter, useLocalSearchParams} from 'expo-router';
import {Icon} from '@rneui/themed';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {SettingItemModal} from '@/components/SettingItemModal';
import {primaryColors} from '@/styles/colorSchemes';
import {PrimaryColor, Theme} from '@/utils/themeUtils';

export default function SettingItemPlayground() {
  const router = useRouter();
  const {theme, setThemeMode, setPrimaryColor} = useTheme();
  const styles = createStyles(theme);
  const {type} = useLocalSearchParams();

  const getTitle = () => {
    switch (type) {
      case 'theme':
        return 'Theme';
      case 'primaryColor':
        return 'Primary Color';
      case 'downloadQuality':
        return 'Download Quality';
      case 'language':
        return 'Language';
      case 'about':
        return 'About';
      case 'privacyPolicy':
        return 'Privacy Policy';
      default:
        return 'Settings';
    }
  };

  const renderSettingOptions = () => {
    switch (type) {
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
            onClose={() => router.back()}
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
            onClose={() => router.back()}
          />
        );
      case 'downloadQuality':
        return (
          <SettingItemModal
            title="Download Quality"
            options={[
              {
                label: 'Low',
                value: 'low',
                onPress: () => console.log('Low quality selected'),
              },
              {
                label: 'Medium',
                value: 'medium',
                onPress: () => console.log('Medium quality selected'),
              },
              {
                label: 'High',
                value: 'high',
                onPress: () => console.log('High quality selected'),
              },
            ]}
            onClose={() => router.back()}
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
                onPress: () => console.log('English selected'),
              },
              {
                label: 'العربية',
                value: 'ar',
                onPress: () => console.log('Arabic selected'),
              },
            ]}
            onClose={() => router.back()}
          />
        );
      case 'about':
      case 'privacyPolicy':
        return (
          <ScrollView style={styles.contentContainer}>
            <Text style={styles.contentText}>
              Content for {type} goes here.
            </Text>
          </ScrollView>
        );
      default:
        return <Text>Unknown setting type</Text>;
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
        <Text style={styles.headerTitle}>{getTitle()}</Text>
      </View>
      {renderSettingOptions()}
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
      paddingHorizontal: '15@ms',
      paddingVertical: '10@vs',
    },
    closeButton: {
      position: 'absolute',
      left: '15@ms',
    },
    headerTitle: {
      fontSize: '20@ms',
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    contentContainer: {
      flex: 1,
      paddingHorizontal: '15@ms',
    },
    contentText: {
      fontSize: '16@ms',
      color: theme.colors.text,
    },
  });
