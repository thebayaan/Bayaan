// import React, {useCallback, useMemo, useEffect, useState} from 'react';
// import {View, Text} from 'react-native';
// import {useRouter, useLocalSearchParams} from 'expo-router';
// import {useTheme} from '@/hooks/useTheme';
// import {moderateScale, ScaledSheet} from 'react-native-size-matters';
// import {useReciterStore} from '@/store/reciterStore';
// import {Theme} from '@/utils/themeUtils';
// import {Button} from '@/components/Button';
// import {getSurahById} from '@/services/dataService';
// import {usePlayerStore} from '@/store/playerStore';
// import BottomSheetModal from '@/components/BottomSheetModal';
// import {usePlayerNavigation} from '@/hooks/usePlayerNavigation';
// import {usePlayback} from '@/hooks/usePlayback';

// export default function SelectReciterModal() {
//   const router = useRouter();
//   const {surahId} = useLocalSearchParams<{surahId: string}>();
//   const {theme} = useTheme();
//   const defaultReciter = useReciterStore(state => state.defaultReciter);
//   const [, setSurahName] = useState<string>('');

//   useEffect(() => {
//     const fetchSurahName = async () => {
//       if (surahId) {
//         const surahIdNumber = parseInt(surahId, 10);
//         if (!isNaN(surahIdNumber)) {
//           const surah = await getSurahById(surahIdNumber);
//           if (surah) {
//             setSurahName(surah.name);
//           }
//         }
//       }
//     };
//     fetchSurahName();
//   }, [surahId]);

//   const snapPoints = useMemo(() => ['45%'], []);

//   usePlayerStore();

//   const {navigateToPlayer} = usePlayerNavigation();
//   const {playTrack} = usePlayback();

//   const handleUseDefaultReciter = useCallback(async () => {
//     if (defaultReciter && surahId) {
//       playTrack(defaultReciter, surahId);
//       navigateToPlayer(defaultReciter.image_url, true);
//     }
//   }, [defaultReciter, surahId, playTrack, navigateToPlayer]);

//   const handleSheetClose = useCallback(() => {
//     router.back();
//   }, [router]);

//   const handleBrowseAllReciters = useCallback(() => {
//     handleSheetClose();
//     requestAnimationFrame(() => {
//       router.push({
//         pathname: './reciter/browse',
//         params: {view: 'all', surahId},
//       });
//     });
//   }, [router, surahId, handleSheetClose]);

//   const handleSearchFavorites = useCallback(() => {
//     handleSheetClose();
//     requestAnimationFrame(() => {
//       router.push({
//         pathname: './reciter/browse',
//         params: {view: 'favorites', surahId},
//       });
//     });
//   }, [router, surahId, handleSheetClose]);

//   return (
//     <BottomSheetModal
//       isVisible={true}
//       onClose={handleSheetClose}
//       snapPoints={snapPoints}>
//       <View style={createStyles(theme).contentContainer}>
//         <Text style={[createStyles(theme).title, {color: theme.colors.text}]}>
//           Select Reciter
//         </Text>
//         <Button
//           title="Browse All Reciters"
//           style={[createStyles(theme).button]}
//           textStyle={createStyles(theme).buttonText}
//           onPress={handleBrowseAllReciters}>
//           <Text style={[createStyles(theme).buttonText]}>
//             Browse All Reciters
//           </Text>
//         </Button>
//         <Button
//           title="Search from Favorites"
//           style={[createStyles(theme).button]}
//           textStyle={createStyles(theme).buttonText}
//           onPress={handleSearchFavorites}>
//           <Text style={[createStyles(theme).buttonText]}>
//             Search from Favorites
//           </Text>
//         </Button>
//         <Button
//           title="Use Default Reciter"
//           style={[createStyles(theme).defaultButton]}
//           textStyle={createStyles(theme).defaultButtonText}
//           onPress={handleUseDefaultReciter}>
//           <Text style={[createStyles(theme).defaultButtonText]}>
//             Use Default Reciter
//           </Text>
//         </Button>
//       </View>
//     </BottomSheetModal>
//   );
// }

// const createStyles = (theme: Theme) =>
//   ScaledSheet.create({
//     contentContainer: {
//       flex: 1,
//       padding: moderateScale(20),
//       backgroundColor: theme.colors.background,
//     },
//     title: {
//       fontSize: moderateScale(24),
//       fontWeight: 'bold',
//       marginBottom: moderateScale(20),
//     },
//     button: {
//       padding: moderateScale(15),
//       borderRadius: moderateScale(20),
//       marginTop: moderateScale(10),
//       backgroundColor: theme.colors.card,
//       borderWidth: moderateScale(0.4),
//       borderColor: theme.colors.border,
//       shadowColor: '#000',
//       shadowOffset: {
//         width: 0,
//         height: 2,
//       },
//       shadowOpacity: 0.25,
//       shadowRadius: 3.84,
//       elevation: 5,
//       size: 'small',
//     },
//     buttonText: {
//       fontSize: moderateScale(16),
//       fontWeight: 'bold',
//       textAlign: 'center',
//       color: theme.colors.text,
//     },
//     defaultButton: {
//       padding: moderateScale(15),
//       borderRadius: moderateScale(20),
//       marginVertical: moderateScale(5),
//       backgroundColor: theme.colors.primary,
//       borderWidth: moderateScale(0.4),
//       borderColor: theme.colors.border,
//       textColor: 'white',
//       textWeight: 'bold',
//       size: 'small',
//     },
//     defaultButtonText: {
//       fontSize: moderateScale(16),
//       fontWeight: 'bold',
//       textAlign: 'center',
//       color: 'white',
//     },
//   });
