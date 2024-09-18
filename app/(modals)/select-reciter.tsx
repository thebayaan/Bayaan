import React, {useCallback, useMemo, useRef, useEffect, useState} from 'react';
import {View, Text} from 'react-native';
import {useRouter, useLocalSearchParams} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import BottomSheet, {BottomSheetBackdrop} from '@gorhom/bottom-sheet';
import {BottomSheetDefaultBackdropProps} from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetBackdrop/types';
import {BottomSheetHandle} from '@gorhom/bottom-sheet';
import {useReciterStore} from '@/store/useReciterStore';
import {Theme} from '@/utils/themeUtils';
import {Button} from '@/components/Button';

export default function SelectReciterModal() {
  const router = useRouter();
  const {surahId} = useLocalSearchParams<{surahId: string}>();
  const {theme} = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const [, setReciterName] = useState<string>('Default Reciter');

  useEffect(() => {
    if (defaultReciter) {
      setReciterName(defaultReciter.name);
    }
  }, [defaultReciter]);

  const snapPoints = useMemo(() => ['50%'], []);

  const handleUseDefaultReciter = useCallback(() => {
    router.replace({
      pathname: '/(modals)/player',
      params: {
        surahId,
        reciterId: defaultReciter ? defaultReciter.id : 'default',
      },
    });
  }, [router, surahId, defaultReciter]);
  const handleSheetClose = useCallback(() => {
    router.back();
    requestAnimationFrame(() => {
      bottomSheetRef.current?.close();
    });
  }, [router]);

  const handleBrowseAllReciters = useCallback(() => {
    handleSheetClose();
    requestAnimationFrame(() => {
      router.push({
        pathname: '/reciter-browse',
        params: {view: 'all', surahId},
      });
    });
  }, [router, surahId, handleSheetClose]);

  const handleSearchFavorites = useCallback(() => {
    handleSheetClose();
    requestAnimationFrame(() => {
      router.push({
        pathname: '/reciter-browse',
        params: {view: 'favorites', surahId},
      });
    });
  }, [router, surahId, handleSheetClose]);

  const renderBackdrop = useCallback(
    (
      props: React.JSX.IntrinsicAttributes & BottomSheetDefaultBackdropProps,
    ) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      backgroundStyle={{backgroundColor: theme.colors.background}}
      enablePanDownToClose={true}
      handleComponent={BottomSheetHandle}
      onClose={handleSheetClose}>
      <View style={createStyles(theme).contentContainer}>
        <Text style={[createStyles(theme).title, {color: theme.colors.text}]}>
          Select Reciter
        </Text>
        <Button
          title="Browse All Reciters"
          style={[createStyles(theme).button]}
          textStyle={createStyles(theme).buttonText}
          onPress={handleBrowseAllReciters}>
          <Text style={[createStyles(theme).buttonText]}>
            Browse All Reciters
          </Text>
        </Button>
        <Button
          title="Search from Favorites"
          style={[createStyles(theme).button]}
          textStyle={createStyles(theme).buttonText}
          onPress={handleSearchFavorites}>
          <Text style={[createStyles(theme).buttonText]}>
            Search from Favorites
          </Text>
        </Button>
        <Button
          title="Use Default Reciter"
          style={[createStyles(theme).defaultButton]}
          textStyle={createStyles(theme).defaultButtonText}
          onPress={handleUseDefaultReciter}>
          <Text style={[createStyles(theme).defaultButtonText]}>
            Use Default Reciter
          </Text>
        </Button>
      </View>
    </BottomSheet>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    contentContainer: {
      flex: 1,
      padding: moderateScale(20),
      backgroundColor: theme.colors.background,
    },
    title: {
      fontSize: moderateScale(24),
      fontWeight: 'bold',
      marginBottom: moderateScale(20),
    },
    button: {
      padding: moderateScale(15),
      borderRadius: moderateScale(20),
      marginTop: moderateScale(10),
      backgroundColor: theme.colors.card,
      borderWidth: moderateScale(0.4),
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      size: 'small',
    },
    buttonText: {
      fontSize: moderateScale(16),
      fontWeight: 'bold',
      textAlign: 'center',
      color: theme.colors.text,
    },
    defaultButton: {
      padding: moderateScale(15),
      borderRadius: moderateScale(20),
      marginVertical: moderateScale(5),
      backgroundColor: theme.colors.primary,
      borderWidth: moderateScale(0.4),
      borderColor: theme.colors.border,
      textColor: 'white',
      textWeight: 'bold',
      size: 'small',
    },
    defaultButtonText: {
      fontSize: moderateScale(16),
      fontWeight: 'bold',
      textAlign: 'center',
      color: 'white',
    },
  });
