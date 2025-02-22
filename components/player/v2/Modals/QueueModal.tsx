// import React, {useCallback, memo, useMemo} from 'react';
// import {
//   View,
//   Text,
//   TouchableOpacity,
//   StyleSheet,
//   FlatList,
//   ListRenderItem,
// } from 'react-native';
// import {moderateScale, verticalScale} from 'react-native-size-matters';
// import {useTheme} from '@/hooks/useTheme';
// import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
// import BottomSheet from '@gorhom/bottom-sheet';
// import {BaseModal} from './BaseModal';
// import {Icon} from '@rneui/themed';
// import {Track} from '@/types/audio';
// import Animated, {
//   useAnimatedStyle,
//   withRepeat,
//   withTiming,
//   withSequence,
//   withDelay,
// } from 'react-native-reanimated';

// interface QueueModalProps {
//   bottomSheetRef: React.RefObject<BottomSheet>;
//   onClose: () => void;
// }

// interface QueueItemProps {
//   item: Track;
//   index: number;
//   isCurrentTrack: boolean;
//   onPress: () => void;
//   onRemove: () => void;
//   textColor: string;
//   borderColor: string;
// }

// const WaveformBar = memo(({delay, color}: {delay: number; color: string}) => {
//   const animatedStyle = useAnimatedStyle(() => {
//     return {
//       transform: [
//         {
//           scaleY: withRepeat(
//             withSequence(
//               withDelay(delay, withTiming(1.5, {duration: 500})),
//               withTiming(0.3, {duration: 500}),
//             ),
//             -1,
//             true,
//           ),
//         },
//       ],
//     };
//   });

//   return (
//     <Animated.View
//       style={[
//         {
//           width: 2,
//           height: 15,
//           backgroundColor: color,
//           borderRadius: 1,
//           marginHorizontal: 1,
//         },
//         animatedStyle,
//       ]}
//     />
//   );
// });

// const Waveform = memo(({color}: {color: string}) => {
//   const bars = useMemo(
//     () =>
//       [0, 100, 200, 300, 400].map(delay => (
//         <WaveformBar key={delay} delay={delay} color={color} />
//       )),
//     [color],
//   );

//   return <View style={styles.waveformContainer}>{bars}</View>;
// });

// const QueueItem = memo<QueueItemProps>(
//   ({
//     item,
//     index,
//     isCurrentTrack,
//     onPress,
//     onRemove,
//     textColor,
//     borderColor,
//   }) => (
//     <TouchableOpacity
//       activeOpacity={0.7}
//       style={[styles.trackItem, {borderBottomColor: borderColor}]}
//       onPress={onPress}>
//       <View style={styles.indexContainer}>
//         {isCurrentTrack ? (
//           <Waveform color={textColor} />
//         ) : (
//           <Text style={[styles.indexText, {color: textColor}]}>
//             {index + 1}
//           </Text>
//         )}
//       </View>
//       <View style={styles.trackInfo}>
//         <Text
//           style={[
//             styles.trackTitle,
//             {color: textColor},
//             isCurrentTrack && styles.currentTrackText,
//           ]}
//           numberOfLines={1}>
//           {item.title}
//         </Text>
//         <Text
//           style={[styles.trackArtist, {color: textColor}]}
//           numberOfLines={1}>
//           {item.artist}
//         </Text>
//       </View>
//       <TouchableOpacity
//         activeOpacity={0.7}
//         style={styles.removeButton}
//         onPress={onRemove}>
//         <Icon
//           name="close"
//           type="material-community"
//           size={moderateScale(20)}
//           color={textColor}
//         />
//       </TouchableOpacity>
//     </TouchableOpacity>
//   ),
// );

// QueueItem.displayName = 'QueueItem';
// WaveformBar.displayName = 'WaveformBar';
// Waveform.displayName = 'Waveform';

// export const QueueModal: React.FC<QueueModalProps> = ({bottomSheetRef}) => {
//   const {theme} = useTheme();
//   const {queue, updateQueue, removeFromQueue, play} = useUnifiedPlayer();

//   const handleTrackPress = useCallback(
//     async (index: number) => {
//       try {
//         await updateQueue(queue.tracks, index);
//         await play();
//       } catch (error) {
//         console.error('Error skipping to track:', error);
//       }
//     },
//     [queue.tracks, updateQueue, play],
//   );

//   const handleRemoveTrack = useCallback(
//     async (index: number) => {
//       try {
//         await removeFromQueue([index]);
//       } catch (error) {
//         console.error('Error removing track:', error);
//       }
//     },
//     [removeFromQueue],
//   );

//   const renderItem: ListRenderItem<Track> = useCallback(
//     ({item, index}) => (
//       <QueueItem
//         item={item}
//         index={index}
//         isCurrentTrack={index === queue.currentIndex}
//         onPress={() => handleTrackPress(index)}
//         onRemove={() => handleRemoveTrack(index)}
//         textColor={theme.colors.text}
//         borderColor={theme.colors.border}
//       />
//     ),
//     [queue.currentIndex, handleTrackPress, handleRemoveTrack, theme.colors],
//   );

//   const keyExtractor = useCallback(
//     (item: Track, index: number) => `${item.id}-${index}`,
//     [],
//   );

//   const ListHeaderComponent = useCallback(
//     () => (
//       <View style={[styles.header, {borderBottomColor: theme.colors.border}]}>
//         <View style={styles.headerLeft}>
//           <Icon
//             name="playlist-music"
//             type="material-community"
//             size={moderateScale(24)}
//             color={theme.colors.text}
//           />
//           <Text style={[styles.headerTitle, {color: theme.colors.text}]}>
//             Now Playing
//           </Text>
//         </View>
//         <View style={styles.headerRight}>
//           <Text style={[styles.queueCount, {color: theme.colors.text}]}>
//             {queue.tracks.length} tracks
//           </Text>
//         </View>
//       </View>
//     ),
//     [queue.tracks.length, theme.colors],
//   );

//   return (
//     <BaseModal
//       bottomSheetRef={bottomSheetRef}
//       title="Queue"
//       snapPoints={['80%']}>
//       <View style={styles.container}>
//         {queue?.tracks?.length > 0 ? (
//           <FlatList
//             data={queue.tracks}
//             renderItem={renderItem}
//             keyExtractor={keyExtractor}
//             ListHeaderComponent={ListHeaderComponent}
//             contentContainerStyle={styles.listContent}
//             removeClippedSubviews={true}
//             maxToRenderPerBatch={10}
//             windowSize={10}
//             initialNumToRender={10}
//             showsVerticalScrollIndicator={false}
//             bounces={true}
//             style={styles.list}
//             overScrollMode="never"
//             scrollEventThrottle={16}
//           />
//         ) : (
//           <View style={styles.emptyContainer}>
//             <Icon
//               name="playlist-music"
//               type="material-community"
//               size={moderateScale(48)}
//               color={theme.colors.text}
//               style={styles.emptyIcon}
//             />
//             <Text style={[styles.emptyText, {color: theme.colors.text}]}>
//               Queue is empty
//             </Text>
//           </View>
//         )}
//       </View>
//     </BaseModal>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },
//   list: {
//     flex: 1,
//   },
//   listContent: {
//     paddingBottom: verticalScale(20),
//   },
//   emptyContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     paddingBottom: verticalScale(100),
//   },
//   trackItem: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingVertical: verticalScale(12),
//     paddingHorizontal: moderateScale(16),
//     borderBottomWidth: StyleSheet.hairlineWidth,
//   },
//   indexContainer: {
//     width: moderateScale(30),
//     alignItems: 'center',
//     justifyContent: 'center',
//     height: moderateScale(30),
//   },
//   waveformContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     height: moderateScale(15),
//   },
//   indexText: {
//     fontSize: moderateScale(14),
//     fontFamily: 'Manrope-Medium',
//     opacity: 0.7,
//   },
//   currentTrack: {
//     backgroundColor: 'rgba(128, 128, 128, 0.1)',
//   },
//   currentTrackText: {
//     fontFamily: 'Manrope-Bold',
//   },
//   trackInfo: {
//     flex: 1,
//     marginRight: moderateScale(16),
//     marginLeft: moderateScale(8),
//   },
//   trackTitle: {
//     fontSize: moderateScale(16),
//     fontFamily: 'Manrope-SemiBold',
//   },
//   trackArtist: {
//     fontSize: moderateScale(14),
//     fontFamily: 'Manrope-Medium',
//     opacity: 0.7,
//     marginTop: verticalScale(4),
//   },
//   removeButton: {
//     padding: moderateScale(8),
//   },
//   emptyIcon: {
//     marginBottom: verticalScale(16),
//     opacity: 0.7,
//   },
//   emptyText: {
//     fontSize: moderateScale(16),
//     fontFamily: 'Manrope-Medium',
//     opacity: 0.7,
//   },
//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingHorizontal: moderateScale(16),
//     paddingVertical: verticalScale(16),
//     borderBottomWidth: StyleSheet.hairlineWidth,
//   },
//   headerLeft: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   headerTitle: {
//     fontSize: moderateScale(16),
//     fontFamily: 'Manrope-Bold',
//     marginLeft: moderateScale(8),
//   },
//   headerRight: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   queueCount: {
//     fontSize: moderateScale(14),
//     fontFamily: 'Manrope-Medium',
//     opacity: 0.7,
//   },
// });
