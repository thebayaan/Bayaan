// import React, {useState, useCallback} from 'react';
// import {View, Text, FlatList, StyleSheet} from 'react-native';
// import {useTheme} from '@/hooks/useTheme';
// import {moderateScale, verticalScale} from 'react-native-size-matters';
// import {CircularReciterCard} from '@/components/cards/CircularReciterCard';
// import {RECITERS, Reciter} from '@/data/reciterData';
// import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
// import SearchBar from '@/components/SearchBar';
// import {LinearGradient} from 'expo-linear-gradient';
// import {useSafeAreaInsets} from 'react-native-safe-area-context';
// import {Button} from '@/components/Button';
// import {Theme} from '@/utils/themeUtils';
// import {useAuthStore} from '@/store/authStore';

// export default function SelectRecitersScreen() {
//   const {theme} = useTheme();
//   const {toggleFavoriteReciter, favoriteReciters} = useFavoriteReciters();
//   const [searchQuery, setSearchQuery] = useState('');
//   const insets = useSafeAreaInsets();
//   const MIN_SELECTIONS = 5;
//   const [isLoading, setIsLoading] = useState(false);

//   const filteredReciters = RECITERS.filter(reciter =>
//     reciter.name.toLowerCase().includes(searchQuery.toLowerCase()),
//   );

//   const handleReciterPress = useCallback(
//     (reciter: Reciter) => {
//       toggleFavoriteReciter(reciter.id);
//     },
//     [toggleFavoriteReciter],
//   );

//   const handleContinue = useCallback(async () => {
//     if (favoriteReciters.length >= MIN_SELECTIONS) {
//       try {
//         setIsLoading(true);
//         const {setHasCompletedOnboarding} = useAuthStore.getState();
//         await setHasCompletedOnboarding(true);
//       } catch (error) {
//         console.error('Error completing onboarding:', error);
//       } finally {
//         setIsLoading(false);
//       }
//     }
//   }, [favoriteReciters.length]);

//   const renderItem = ({item}: {item: Reciter}) => (
//     <CircularReciterCard
//       imageUrl={item.image_url}
//       name={item.name}
//       onPress={() => handleReciterPress(item)}
//       isSelected={favoriteReciters.some(reciter => reciter.id === item.id)}
//     />
//   );

//   return (
//     <View style={styles(theme).container}>
//       <LinearGradient
//         colors={[theme.colors.primary, theme.colors.background]}
//         style={[
//           styles(theme).header,
//           {paddingTop: insets.top + moderateScale(50)},
//         ]}>
//         <Text style={[styles(theme).title, {color: theme.colors.text}]}>
//           Select Your Favorite Reciters
//         </Text>
//         <Text
//           style={[styles(theme).subtitle, {color: theme.colors.textSecondary}]}>
//           Choose at least {MIN_SELECTIONS} reciters to get started
//         </Text>
//       </LinearGradient>
//       <View style={styles(theme).searchContainer}>
//         <SearchBar
//           placeholder="Search reciters..."
//           value={searchQuery}
//           onChangeText={setSearchQuery}
//         />
//       </View>
//       <FlatList
//         data={filteredReciters}
//         renderItem={renderItem}
//         keyExtractor={item => item.id}
//         numColumns={3}
//         contentContainerStyle={styles(theme).gridContainer}
//         columnWrapperStyle={styles(theme).columnWrapper}
//       />

//       <View style={styles(theme).footerContainer}>
//         <LinearGradient
//           colors={[
//             'transparent',
//             theme.colors.background + '80', // 50% opacity
//             theme.colors.background,
//           ]}
//           style={styles(theme).footerGradient}>
//           <View style={styles(theme).footer}>
//             <Button
//               title={`Continue ${
//                 favoriteReciters.length >= MIN_SELECTIONS
//                   ? ''
//                   : `${favoriteReciters.length}/${MIN_SELECTIONS}`
//               }`}
//               onPress={handleContinue}
//               disabled={favoriteReciters.length < MIN_SELECTIONS}
//               loading={isLoading}
//               style={[
//                 styles(theme).button,
//                 favoriteReciters.length >= MIN_SELECTIONS
//                   ? styles(theme).buttonEnabled
//                   : styles(theme).buttonDisabled,
//               ]}
//               textStyle={styles(theme).buttonText}
//               size="medium"
//             />
//           </View>
//         </LinearGradient>
//       </View>
//     </View>
//   );
// }

// const styles = (theme: Theme) =>
//   StyleSheet.create({
//     container: {
//       flex: 1,
//       backgroundColor: theme.colors.background,
//     },
//     header: {
//       paddingHorizontal: moderateScale(20),
//       paddingBottom: moderateScale(30),
//       alignItems: 'center',
//     },
//     title: {
//       fontSize: moderateScale(24),
//       fontWeight: 'bold',
//       marginBottom: verticalScale(8),
//       textAlign: 'center',
//     },
//     subtitle: {
//       fontSize: moderateScale(16),
//       textAlign: 'center',
//     },
//     searchContainer: {
//       paddingHorizontal: moderateScale(15),
//       paddingBottom: moderateScale(15),
//     },
//     gridContainer: {
//       padding: moderateScale(15),
//     },
//     columnWrapper: {
//       justifyContent: 'space-between',
//       marginBottom: verticalScale(15),
//     },
//     footerContainer: {
//       position: 'absolute',
//       bottom: 0,
//       left: 0,
//       right: 0,
//     },
//     footerGradient: {
//       paddingTop: moderateScale(30), // Increase this value for a longer gradient
//       paddingHorizontal: moderateScale(15),
//     },
//     footer: {
//       paddingBottom: moderateScale(40),
//       alignItems: 'center',
//     },
//     button: {
//       borderRadius: moderateScale(30),
//       width: '35%',
//       backgroundColor: theme.colors.primary,
//       paddingVertical: verticalScale(10),
//     },
//     buttonEnabled: {
//       backgroundColor: theme.colors.text,
//     },
//     buttonDisabled: {
//       backgroundColor: theme.colors.border,
//     },
//     buttonText: {
//       color: theme.colors.background,
//       fontWeight: 'bold',
//       fontSize: moderateScale(14),
//     },
//   });
