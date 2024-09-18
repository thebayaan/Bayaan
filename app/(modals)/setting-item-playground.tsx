import React, {useState, useCallback} from 'react';
import {View, Text, TouchableOpacity, FlatList, ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter, useLocalSearchParams} from 'expo-router';
import {Icon} from '@rneui/themed';
import {useTheme} from '@/hooks/useTheme';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {SettingItemModal} from '@/components/SettingItemModal';
import {primaryColors} from '@/styles/colorSchemes';
import {PrimaryColor, Theme} from '@/utils/themeUtils';
import SearchBar from '@/components/SearchBar';
import {RECITERS, Reciter} from '@/data/reciterData';
import {ReciterItem} from '@/components/ReciterItem';
import {useReciterStore} from '@/store/useReciterStore';

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
      case 'defaultReciter':
        return 'Default Reciter';
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
      case 'defaultReciter':
        return <ReciterSelectionScreen onClose={() => router.back()} />;
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

const ReciterSelectionScreen = ({onClose}: {onClose: () => void}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Reciter[]>([]);
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const setDefaultReciter = useReciterStore(state => state.setDefaultReciter);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setSearchResults([]);
    } else {
      const filtered = RECITERS.filter(reciter =>
        reciter.name.toLowerCase().includes(query.toLowerCase()),
      );
      setSearchResults(filtered);
    }
  }, []);

  const handleReciterSelect = useCallback(
    (reciter: Reciter) => {
      setDefaultReciter(reciter);
      onClose();
    },
    [onClose, setDefaultReciter],
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <SearchBar
          placeholder="Search reciters..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>
      <FlatList
        data={searchResults}
        renderItem={({item}) => (
          <ReciterItem item={item} onPress={handleReciterSelect} />
        )}
        keyExtractor={item => item.id}
        style={styles.reciterList}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {searchQuery.trim() === ''
              ? 'Start typing to search for reciters'
              : 'No reciters found'}
          </Text>
        }
      />
    </View>
  );
};

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
      fontSize: moderateScale(20),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    searchContainer: {
      marginHorizontal: moderateScale(15),
      marginBottom: verticalScale(2),
      marginTop: verticalScale(10),
    },
    contentContainer: {
      flex: 1,
      paddingHorizontal: moderateScale(15),
    },
    contentText: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
    },
    reciterItem: {
      paddingVertical: moderateScale(15),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    reciterName: {
      fontSize: moderateScale(16),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    reciterInfo: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
      marginTop: moderateScale(5),
    },
    reciterList: {
      flex: 1,
      paddingHorizontal: moderateScale(15),
    },
    emptyText: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
      textAlign: 'center',
      paddingVertical: moderateScale(15),
    },
  });
