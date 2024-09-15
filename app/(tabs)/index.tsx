import React, {useState} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {useRouter} from 'expo-router';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from './styles';
import {moderateScale} from 'react-native-size-matters';

import RecitersView from '@/components/RecitersView';
import SurahsView from '@/components/SurahsView';

export default function HomeScreen() {
  const router = useRouter();
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const [activeView, setActiveView] = useState<'Reciters' | 'Surahs'>(
    'Reciters',
  );

  const handleToggle = (option: 'Reciters' | 'Surahs') => {
    setActiveView(option);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Home</Text>
        <TouchableOpacity
          style={styles.settingsIcon}
          onPress={() => router.push('/(modals)/settings')}>
          <Icon
            name="settings-sharp"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            activeView === 'Reciters' && styles.activeToggleButton,
          ]}
          onPress={() => handleToggle('Reciters')}>
          <Text
            style={[
              styles.toggleButtonText,
              activeView === 'Reciters' && styles.activeToggleButtonText,
            ]}>
            Reciters
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            activeView === 'Surahs' && styles.activeToggleButton,
          ]}
          onPress={() => handleToggle('Surahs')}>
          <Text
            style={[
              styles.toggleButtonText,
              activeView === 'Surahs' && styles.activeToggleButtonText,
            ]}>
            Surahs
          </Text>
        </TouchableOpacity>
      </View>
      {activeView === 'Reciters' ? <RecitersView /> : <SurahsView />}
    </SafeAreaView>
  );
}
