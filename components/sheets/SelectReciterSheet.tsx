import React, {useCallback, useState} from 'react';
import {View, Text, Pressable, Switch, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useReciterStore} from '@/store/reciterStore';
import {Theme} from '@/utils/themeUtils';
import {getSurahById} from '@/services/dataService';
import ActionSheet, {
  SheetProps,
  SheetManager,
} from 'react-native-actions-sheet';
import {useSettings} from '@/hooks/useSettings';
import {useReciterSelection} from '@/hooks/useReciterSelection';
import Color from 'color';
import {useRouter} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {DiscoverIcon} from '@/components/Icons';

export const SelectReciterSheet = (props: SheetProps<'select-reciter'>) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const [, setSurahName] = useState<string>('');
  const {playWithReciter, playWithRandomReciter} = useReciterSelection();

  const payload = props.payload;
  const surahId = payload?.surahId ?? '';
  const source = payload?.source;

  const {askEveryTime, setAskEveryTime, setDefaultReciterSelection} =
    useSettings();
  const router = useRouter();

  React.useEffect(() => {
    const fetchSurahName = async () => {
      if (surahId) {
        const surahIdNumber = parseInt(surahId, 10);
        if (!isNaN(surahIdNumber)) {
          const surah = await getSurahById(surahIdNumber);
          if (surah) {
            setSurahName(surah.name);
          }
        }
      }
    };
    fetchSurahName();
  }, [surahId]);

  const handleClose = useCallback(() => {
    SheetManager.hide('select-reciter');
  }, []);

  const handleUseDefaultReciter = useCallback(async () => {
    if (!surahId || !defaultReciter) return;
    handleClose();
    playWithReciter(defaultReciter, surahId).catch(error => {
      console.error('Error playing with default reciter:', error);
    });
  }, [defaultReciter, surahId, playWithReciter, handleClose]);

  const handleUseRandomReciter = useCallback(async () => {
    if (!surahId) return;
    handleClose();
    playWithRandomReciter(surahId).catch(error => {
      console.error('Error playing with random reciter:', error);
    });
  }, [surahId, playWithRandomReciter, handleClose]);

  const handleBrowseAllReciters = useCallback(() => {
    if (!surahId) return;

    const route =
      source === 'search'
        ? '/(tabs)/(b.search)/reciter/browse'
        : '/(tabs)/(a.home)/reciter/browse';

    handleClose();
    router.push({
      pathname: route,
      params: {
        view: 'all',
        surahId,
      },
    });
  }, [surahId, source, handleClose, router]);

  const handleReciterSelection = useCallback(
    (action: () => void, selection: string | null) => {
      if (!askEveryTime) {
        setDefaultReciterSelection(selection);
      }
      action();
    },
    [askEveryTime, setDefaultReciterSelection],
  );

  const handleAskEveryTimeToggle = useCallback(() => {
    setAskEveryTime(!askEveryTime);
  }, [askEveryTime, setAskEveryTime]);

  if (!surahId) {
    return null;
  }

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Reciter</Text>
        </View>

        <View style={styles.optionsGrid}>
          <Pressable
            style={({pressed}) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
            onPress={() =>
              handleReciterSelection(handleUseDefaultReciter, 'useDefault')
            }>
            <Ionicons
              name="person-outline"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
            <Text style={styles.optionText}>Use Default Reciter</Text>
          </Pressable>

          <Pressable
            style={({pressed}) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
            onPress={() =>
              handleReciterSelection(handleUseRandomReciter, 'randomReciter')
            }>
            <DiscoverIcon size={moderateScale(20)} color={theme.colors.text} />
            <Text style={styles.optionText}>Random Reciter</Text>
          </Pressable>

          <Pressable
            style={({pressed}) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
            onPress={() =>
              handleReciterSelection(handleBrowseAllReciters, 'browseAll')
            }>
            <Ionicons
              name="people-outline"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
            <Text style={styles.optionText}>Browse All Reciters</Text>
          </Pressable>
        </View>

        <View style={styles.askEveryTimeContainer}>
          <Text style={styles.askEveryTimeText}>Ask every time</Text>
          <Switch
            value={askEveryTime}
            onValueChange={handleAskEveryTimeToggle}
            trackColor={{
              false: Color(theme.colors.text).alpha(0.1).toString(),
              true: Color(theme.colors.text).alpha(0.65).toString(),
            }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
      height: 2.5,
    },
    container: {
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(40),
    },
    header: {
      alignItems: 'center',
      marginTop: moderateScale(8),
      marginBottom: moderateScale(20),
    },
    headerTitle: {
      fontSize: moderateScale(20),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    optionsGrid: {
      gap: moderateScale(8),
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      paddingHorizontal: moderateScale(16),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderRadius: moderateScale(12),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    optionPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    optionText: {
      flex: 1,
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginLeft: moderateScale(12),
    },
    askEveryTimeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      marginTop: moderateScale(16),
      borderTopWidth: 1,
      borderTopColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    askEveryTimeText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
  });
