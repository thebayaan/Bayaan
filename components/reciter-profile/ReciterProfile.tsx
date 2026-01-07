import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  Animated as RNAnimated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {Surah} from '@/data/surahData';
import {Reciter, Rewayat} from '@/data/reciterData';
import {getReciterById, getAllSurahs} from '@/services/dataService';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {StatusBar} from 'expo-status-bar';
import {reciterImages} from '@/utils/reciterImages';
import {Asset} from 'expo-asset';
import {useImageColors} from '@/hooks/useImageColors';
import {useLoved} from '@/hooks/useLoved';
import {useUnifiedPlayer} from '@/services/player/store/playerStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {createTracksForReciter} from '@/utils/track';
import {QueueContext} from '@/services/queue/QueueContext';
import {shuffleArray} from '@/utils/arrayUtils';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useModal} from '@/components/providers/ModalProvider';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {useDownload} from '@/services/player/store/downloadStore';
import {createSharedStyles} from './styles';
import {useSettings} from '@/hooks/useSettings';
import {RewayatStyle} from '@/types/reciter';
import {Icon} from '@rneui/themed';
import {HeartIcon} from '@/components/Icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { useLocalRecitersStore } from '@/store/localRecitersStore';
import { useAllReciters } from '@/hooks/useAllReciters';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import BottomSheetModal from '@/components/BottomSheetModal';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

// Import components directly
import {ActionButtons} from './components/ActionButtons';
import {ReciterHeader} from './components/ReciterHeader';
import {StickyHeader} from './components/StickyHeader';
import {NavigationButtons} from './components/NavigationButtons';
import {SurahList} from './components/SurahList';
import {SearchView} from './components/SearchView';
import {moderateScale} from 'react-native-size-matters';

interface ReciterProfileProps {
  id: string;
  showLoved?: boolean;
}

// Define types matching useSettings
type ReciterProfileViewMode = 'card' | 'list';
type ReciterProfileSortOption = 'asc' | 'desc' | 'revelation';

// Create a proper memoized wrapper for SurahList
const MemoizedSurahList = React.memo(SurahList);

const ReciterProfile: React.FC<ReciterProfileProps> = ({
  id: currentReciterId,
  showLoved = false,
}) => {
  const {theme} = useTheme();
  const styles = createSharedStyles(theme);
  const insets = useSafeAreaInsets();
  const [reciter, setReciter] = useState<Reciter | null>(null);
  const { getReciterById } = useAllReciters();
  const { updateLocalReciter, removeLocalReciter } = useLocalRecitersStore();
  const router = useRouter();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [filteredSurahs, setFilteredSurahs] = useState<Surah[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRewayatId, setSelectedRewayatId] = useState<
    string | undefined
  >(undefined);

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const iconsOpacity = useRef(new RNAnimated.Value(1)).current;
  const iconsZIndex = useRef(new RNAnimated.Value(1)).current;
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);
  const [isStatusBarDark, setIsStatusBarDark] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [viewMode, setViewMode] = useState<ReciterProfileViewMode>(
    useSettings(state => state.reciterProfileViewMode),
  );
  const [sortOption, setSortOption] = useState<ReciterProfileSortOption>(
    useSettings(state => state.reciterProfileSortOption),
  );
  const [showLovedOnly, setShowLovedOnly] = useState(showLoved);
  const flatListRef = useRef<RNAnimated.FlatList>(null);
  const {isLovedWithRewayat} = useLoved();
  const {isDownloaded} = useDownload();
  const {addRecentTrack, removeReciterTracks} = useRecentlyPlayedStore();
  const {showSurahOptions, showRewayatInfo} = useModal();
  const {reciterPreferences, setReciterPreference} = useSettings();
  const [showEditReciterModal, setShowEditReciterModal] = useState(false);
  const [editableReciterName, setEditableReciterName] = useState('');
  const [editableRewayat, setEditableRewayat] = useState<Rewayat[]>([]);
  const [newRewayatName, setNewRewayatName] = useState('');

  // Retrieve persisted reciter profile settings
  const setReciterViewModeSetting = useSettings(
    state => state.setReciterProfileViewMode,
  );
  const setReciterSortOptionSetting = useSettings(
    state => state.setReciterProfileSortOption,
  );

  const headerOpacity = scrollY.interpolate({
    inputRange: [100, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const selectedRewayat = useMemo(() => {
    if (!reciter) return undefined;
    if (!selectedRewayatId) return reciter.rewayat[0];
    return (
      reciter.rewayat.find(r => r.id === selectedRewayatId) ||
      reciter.rewayat[0]
    );
  }, [reciter, selectedRewayatId]);

  const availableSurahs = useMemo(() => {
    if (reciter?.isLocal) return surahs;
    if (!selectedRewayat?.surah_list) return surahs;
    const validSurahs = selectedRewayat.surah_list.filter(
      (id): id is number => id !== null,
    );
    return surahs.filter(surah => validSurahs.includes(surah.id));
  }, [surahs, selectedRewayat, reciter?.isLocal]);

  const playableSurahIds = useMemo(() => {
    if (!selectedRewayat?.surah_list) return [];
    return selectedRewayat.surah_list.filter(
      (id): id is number => id !== null,
    );
  }, [selectedRewayat]);

  const filteredSurahsMemo = useMemo(() => {
    // Start with available surahs for the selected rewayat
    let surahsToProcess = availableSurahs;

    // Filter by loved status if toggled and a rewayat is selected
    if (showLovedOnly && selectedRewayat?.id) {
      surahsToProcess = surahsToProcess.filter(surah =>
        isLovedWithRewayat(
          currentReciterId,
          surah.id.toString(),
          selectedRewayat.id,
        ),
      );
    }

    // Filter by search query if present
    const filtered = searchQuery
      ? surahsToProcess.filter(
          surah =>
            surah.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            surah.translated_name_english
              .toLowerCase()
              .includes(searchQuery.toLowerCase()),
        )
      : surahsToProcess;

    // Sort based on sortOption
    return [...filtered].sort((a, b) => {
      if (sortOption === 'asc') {
        return a.id - b.id;
      } else if (sortOption === 'desc') {
        return b.id - a.id;
      } else if (sortOption === 'revelation') {
        return a.revelation_order - b.revelation_order;
      }
      return 0;
    });
  }, [
    availableSurahs,
    showLovedOnly,
    isLovedWithRewayat,
    currentReciterId,
    selectedRewayat,
    searchQuery,
    sortOption,
  ]);

  const playableSurahs = useMemo(() => {
    if (!reciter?.isLocal) return filteredSurahs;
    if (playableSurahIds.length === 0) return [];
    return filteredSurahs.filter(surah => playableSurahIds.includes(surah.id));
  }, [filteredSurahs, reciter?.isLocal, playableSurahIds]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const reciterData = getReciterById(currentReciterId);
        if (reciterData) {
          // Sort rewayat to prioritize Murattal Hafs A'n Assem
          // Clone to avoid mutation
          const sortedRewayat = sortRewayat([...reciterData.rewayat]);
          const processedReciter = { ...reciterData, rewayat: sortedRewayat };
          
          setReciter(processedReciter);

          // Use saved preference or default to first rewayat
          const savedRewayatId = reciterPreferences[currentReciterId];
          const validRewayat =
            savedRewayatId &&
            processedReciter.rewayat.find(r => r.id === savedRewayatId);

          if (validRewayat) {
            setSelectedRewayatId(validRewayat.id);
          } else if (processedReciter.rewayat.length > 0) {
            setSelectedRewayatId(processedReciter.rewayat[0].id);
          }
        }
        const surahsData = await getAllSurahs();
        setSurahs(surahsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, [currentReciterId, reciterPreferences, getReciterById]);

  useEffect(() => {
    const listener = headerOpacity.addListener(({value}) => {
      if (value === 1 && !isHeaderVisible) {
        setIsHeaderVisible(true);
      } else if (value < 1 && isHeaderVisible) {
        setIsHeaderVisible(false);
      }
    });

    return () => headerOpacity.removeListener(listener);
  }, [headerOpacity, isHeaderVisible]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const {updateQueue, play, addToQueue} = useUnifiedPlayer();
  const playerStore = usePlayerStore();
  const queueContext = QueueContext.getInstance();
  const {toggleFavorite, isFavoriteReciter} = useFavoriteReciters();

  const handleAddAudio = useCallback(async (surah: Surah) => {
    if (!reciter?.isLocal || !selectedRewayat) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const extension = asset.name.split('.').pop() || 'mp3';
      const paddedSurahId = surah.id.toString().padStart(3, '0');
      const fileName = `${paddedSurahId}.${extension}`;

      // selectedRewayat.server is file://.../reciters/{id}
      const destDir = selectedRewayat.server.replace('file://', '') + (selectedRewayat.server.endsWith('/') ? '' : '/');
      
      // Ensure directory exists
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });

      const destPath = `${destDir}${fileName}`;

      await FileSystem.copyAsync({
        from: asset.uri,
        to: destPath,
      });

      // Update Store
      const existingIds = new Set(
        (selectedRewayat.surah_list || []).filter(
          (id): id is number => id !== null,
        ),
      );
      existingIds.add(surah.id);

      const updatedRewayat = {
        ...selectedRewayat,
        surah_list: Array.from(existingIds),
        surah_total: existingIds.size,
        fileExtension: extension,
      };

      const updatedReciter = {
        ...reciter,
        rewayat: reciter.rewayat.map(r => r.id === updatedRewayat.id ? updatedRewayat : r)
      };

      updateLocalReciter(updatedReciter);
      setReciter(updatedReciter);
      
      Alert.alert('Success', `Added audio for ${surah.name}`);
    } catch (error) {
      console.error('Error adding audio:', error);
      Alert.alert('Error', 'Failed to add audio file');
    }
  }, [reciter, selectedRewayat, updateLocalReciter]);

  const handleEditImage = useCallback(async () => {
    if (!reciter?.isLocal) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    const baseDirFromRewayat =
      selectedRewayat?.server?.replace('file://', '') || '';
    const reciterDir =
      baseDirFromRewayat && baseDirFromRewayat.length > 0
        ? baseDirFromRewayat.endsWith('/')
          ? baseDirFromRewayat
          : `${baseDirFromRewayat}/`
        : `${FileSystem.documentDirectory}reciters/${reciter.id}/`;

    try {
      await FileSystem.makeDirectoryAsync(reciterDir, {intermediates: true});
      const destPath = `${reciterDir}${reciter.id}-profile.jpg`;
      await FileSystem.copyAsync({from: asset.uri, to: destPath});

      const updatedReciter = {...reciter, image_url: destPath};
      updateLocalReciter(updatedReciter);
      setReciter(updatedReciter);
    } catch (error) {
      console.error('Error updating reciter image:', error);
      Alert.alert('Error', 'Failed to update image');
    }
  }, [reciter, selectedRewayat, updateLocalReciter]);

  const openEditReciterModal = useCallback(() => {
    if (!reciter) return;
    setEditableReciterName(reciter.name);
    setEditableRewayat(reciter.rewayat);
    setNewRewayatName('');
    setShowEditReciterModal(true);
  }, [reciter]);

  const handleAddRewayatTab = useCallback(() => {
    if (!reciter) return;
    const trimmed = newRewayatName.trim();
    if (!trimmed) return;
    const baseServer =
      reciter.rewayat[0]?.server ||
      `file://${FileSystem.documentDirectory}reciters/${reciter.id}/`;
    const newTab: Rewayat = {
      id: Crypto.randomUUID(),
      reciter_id: reciter.id,
      name: trimmed,
      style: 'murattal',
      server: baseServer,
      surah_total: 0,
      surah_list: [],
      source_type: 'local',
      created_at: new Date().toISOString(),
      isLocal: true,
      fileExtension: 'mp3',
    };
    setEditableRewayat(prev => [...prev, newTab]);
    setNewRewayatName('');
  }, [newRewayatName, reciter]);

  const handleRemoveRewayatTab = useCallback(
    (id: string) => {
      setEditableRewayat(prev => prev.filter(r => r.id !== id));
    },
    [setEditableRewayat],
  );

  const handleSaveReciterEdits = useCallback(() => {
    if (!reciter) return;
    const trimmedName = editableReciterName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Reciter name cannot be empty');
      return;
    }
    if (editableRewayat.length === 0) {
      Alert.alert('Error', 'Add at least one tab');
      return;
    }

    const updatedReciter: Reciter = {
      ...reciter,
      name: trimmedName,
      rewayat: editableRewayat,
    };

    // Ensure selected rewayat still exists
    let nextSelected = selectedRewayatId;
    if (nextSelected && !editableRewayat.find(r => r.id === nextSelected)) {
      nextSelected = editableRewayat[0].id;
      setSelectedRewayatId(nextSelected);
      setReciterPreference(reciter.id, nextSelected);
    }

    updateLocalReciter(updatedReciter);
    setReciter(updatedReciter);
    setShowEditReciterModal(false);
  }, [
    editableReciterName,
    editableRewayat,
    reciter,
    selectedRewayatId,
    setReciterPreference,
    updateLocalReciter,
  ]);

  const handleDeleteReciter = useCallback(() => {
    if (!reciter) return;

    Alert.alert(
      'Delete Reciter',
      `Are you sure you want to delete ${reciter.name}? This action cannot be undone and will delete all associated audio files.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // 1. Delete reciter folder
              const reciterDir = `${FileSystem.documentDirectory}reciters/${reciter.id}/`;
              const dirInfo = await FileSystem.getInfoAsync(reciterDir);
              if (dirInfo.exists) {
                await FileSystem.deleteAsync(reciterDir);
              }

              // 2. Remove from store
              removeLocalReciter(reciter.id);
              removeReciterTracks(reciter.id);

              // 3. Go back
              router.back();
            } catch (error) {
              console.error('Error deleting reciter:', error);
              Alert.alert('Error', 'Failed to delete reciter files');
            }
          },
        },
      ],
    );
  }, [reciter, removeLocalReciter, router]);

  const renderEditModal = () => {
    if (!reciter) return null;
    return (
      <BottomSheetModal
        isVisible={showEditReciterModal}
        onClose={() => setShowEditReciterModal(false)}
        snapPoints={['73%']}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Edit Reciter</Text>
          <Text style={styles.modalLabel}>Reciter name</Text>
          <TextInput
            value={editableReciterName}
            onChangeText={setEditableReciterName}
            style={styles.modalInput}
            placeholder="Reciter name"
          />

          <Text style={styles.modalLabel}>Tabs (rewayat)</Text>
          <ScrollView
            style={styles.modalList}
            contentContainerStyle={styles.modalListContent}>
            {editableRewayat.map(tab => (
              <View key={tab.id} style={styles.modalTabRow}>
                <TextInput
                  value={tab.name}
                  onChangeText={text =>
                    setEditableRewayat(prev =>
                      prev.map(r => (r.id === tab.id ? {...r, name: text} : r)),
                    )
                  }
                  style={styles.modalInputFlex}
                  placeholder="Tab name"
                />
                <TouchableOpacity
                  onPress={() => handleRemoveRewayatTab(tab.id)}
                  style={styles.modalRemove}>
                  <Icon
                    name="trash-2"
                    type="feather"
                    size={16}
                    color="#c0392b"
                  />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={styles.modalAddRow}>
            <TextInput
              value={newRewayatName}
              onChangeText={setNewRewayatName}
              style={[styles.modalInputFlex, {marginRight: moderateScale(8)}]}
              placeholder="New tab name"
            />
            <TouchableOpacity
              style={styles.modalAddButton}
              onPress={handleAddRewayatTab}>
              <Text style={styles.modalAddText}>Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancel]}
              onPress={() => setShowEditReciterModal(false)}>
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalSave]}
              onPress={handleSaveReciterEdits}>
              <Text style={[styles.modalButtonText, styles.modalSaveText]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[
              styles.modalButton,
              {
                marginTop: moderateScale(15),
                backgroundColor: '#fee2e2',
                borderWidth: 0,
                flex: 0,
                width: '100%',
              },
            ]}
            onPress={handleDeleteReciter}>
            <Text style={[styles.modalButtonText, {color: '#dc2626'}]}>
              Delete Reciter
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    );
  };

  const handleSurahPress = useCallback(
    async (surah: Surah) => {
      if (!reciter || !selectedRewayat) return;

      // For local reciters, block playback if audio not uploaded and only queue playable surahs
      if (reciter.isLocal) {
        const isUploaded = selectedRewayat.surah_list?.includes(surah.id);
        if (!isUploaded) {
          Alert.alert(
            'Add Audio',
            `Upload audio for ${surah.name}?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Pick File', onPress: () => handleAddAudio(surah) },
            ]
          );
          return;
        }
      }

      try {
        const sourceSurahs = reciter.isLocal ? playableSurahs : filteredSurahs;
        const startIndex = sourceSurahs.findIndex(s => s.id === surah.id);
        if (startIndex === -1) return;

        const tracks = await createTracksForReciter(
          reciter,
          sourceSurahs,
          selectedRewayat.id,
        );
        const reorderedTracks = [
          ...tracks.slice(startIndex),
          ...tracks.slice(0, startIndex),
        ];

        await updateQueue(reorderedTracks, 0);
        await play();
        await addRecentTrack(reciter, surah, 0, 0, selectedRewayat.id);
        queueContext.setCurrentReciter(reciter);
      } catch (error) {
        console.error('Error playing surah:', error);
      }
    },
    [
      reciter,
      filteredSurahs,
      playableSurahs,
      selectedRewayat,
      updateQueue,
      play,
      queueContext,
      addRecentTrack,
      handleAddAudio,
    ],
  );

  const handlePlayAll = useCallback(async () => {
    if (!reciter || !selectedRewayat) return;
    const sourceSurahs = reciter.isLocal ? playableSurahs : filteredSurahs;
    if (reciter.isLocal && sourceSurahs.length === 0) {
      Alert.alert('No audio', 'Please upload audio files before playing.');
      return;
    }
    try {
      const tracks = await createTracksForReciter(
        reciter,
        sourceSurahs,
        selectedRewayat.id,
      );
      await updateQueue(tracks, 0);
      await play();

      if (sourceSurahs.length > 0) {
        await addRecentTrack(
          reciter,
          sourceSurahs[0],
          0,
          0,
          selectedRewayat.id,
        );
      }

      queueContext.setCurrentReciter(reciter);
    } catch (error) {
      console.error('Error playing all surahs:', error);
    }
  }, [
    reciter,
    filteredSurahs,
    playableSurahs,
    selectedRewayat,
    updateQueue,
    play,
    queueContext,
    addRecentTrack,
  ]);

  const handleShuffleAll = useCallback(async () => {
    if (!reciter || !selectedRewayat) return;
    const sourceSurahs = reciter.isLocal ? playableSurahs : filteredSurahs;
    if (reciter.isLocal && sourceSurahs.length === 0) {
      Alert.alert('No audio', 'Please upload audio files before shuffling.');
      return;
    }
    try {
      const tracks = await createTracksForReciter(
        reciter,
        sourceSurahs,
        selectedRewayat.id,
      );
      const shuffledTracks = shuffleArray([...tracks]);
      await updateQueue(shuffledTracks, 0);

      // Enable shuffle mode in player settings
      if (!playerStore.settings.shuffle) {
        playerStore.toggleShuffle();
      }

      await play();

      if (sourceSurahs.length > 0) {
        const firstTrackSurahId = shuffledTracks[0].surahId;
        if (firstTrackSurahId) {
          const firstSurah = sourceSurahs.find(
            s => s.id === parseInt(firstTrackSurahId, 10),
          );
          if (firstSurah) {
            await addRecentTrack(reciter, firstSurah, 0, 0, selectedRewayat.id);
          }
        }
      }

      queueContext.setCurrentReciter(reciter);
    } catch (error) {
      console.error('Error shuffling surahs:', error);
    }
  }, [
    reciter,
    filteredSurahs,
    playableSurahs,
    selectedRewayat,
    updateQueue,
    play,
    queueContext,
    addRecentTrack,
    playerStore,
  ]);

  const handleToggleFavorite = useCallback(() => {
    if (reciter) {
      toggleFavorite(reciter);
    }
  }, [reciter, toggleFavorite]);

  const handleRewayatChange = useCallback(
    (rewayatId: string) => {
      setSelectedRewayatId(rewayatId);
      setReciterPreference(currentReciterId, rewayatId);
    },
    [currentReciterId, setReciterPreference],
  );

  // Memoize the rewayat list to prevent unnecessary re-renders
  const rewayatList = useMemo(() => {
    if (!reciter?.rewayat) return [];
    return reciter.rewayat.map(r => ({
      id: r.id,
      name: r.name,
      style: r.style,
      surah_list: r.surah_list,
    }));
  }, [reciter?.rewayat]);

  const handleRewayatInfoPress = useCallback(() => {
    if (!reciter) return;

    // Convert rewayat array to RewayatStyle array format expected by the modal
    const rewayatStyles: RewayatStyle[] = reciter.rewayat.map(r => ({
      id: r.id,
      name: r.name,
      style: r.style,
      surah_list: r.surah_list,
    }));

    showRewayatInfo(rewayatStyles, selectedRewayatId, handleRewayatChange);
  }, [handleRewayatChange, reciter, selectedRewayatId, showRewayatInfo]);

  const dominantColors = useImageColors(reciter?.name);
  const isLoadingColors =
    !dominantColors.primary || dominantColors.primary === theme.colors.primary;
  const [isImagePreloaded, setIsImagePreloaded] = useState(false);

  useEffect(() => {
    if (reciter?.name) {
      const formattedName = reciter.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      const localImageSource = reciterImages[formattedName];
      if (localImageSource) {
        Asset.fromModule(localImageSource as number)
          .downloadAsync()
          .then(() => setIsImagePreloaded(true))
          .catch(error => {
            console.error('Error preloading image:', error);
            setIsImagePreloaded(true);
          });
      } else {
        setIsImagePreloaded(true);
      }
    }
  }, [reciter?.name]);

  useEffect(() => {
    setFilteredSurahs(filteredSurahsMemo);
  }, [filteredSurahsMemo]);

  // Maintain scroll position reference outside of react state
  const scrollPosition = useRef(0);

  // Create a scroll event listener for status bar updates
  const handleStatusBarUpdate = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      if (!theme.isDarkMode) {
        setIsStatusBarDark(offsetY > 100);
      }
    },
    [theme.isDarkMode],
  );

  // Save scroll position separately
  const handleSaveScrollPosition = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollPosition.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );

  // Create a proper animated scroll event
  const handleScroll = RNAnimated.event(
    [{nativeEvent: {contentOffset: {y: scrollY}}}],
    {
      useNativeDriver: true,
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        handleStatusBarUpdate(event);
        handleSaveScrollPosition(event);
      },
    },
  );

  const handleAddToQueue = useCallback(
    async (surah: Surah) => {
      if (!reciter || !selectedRewayat) return;
      try {
        // Create track for just this surah
        const tracks = await createTracksForReciter(
          reciter,
          [surah],
          selectedRewayat.id,
        );

        // Add to queue
        await addToQueue(tracks);
      } catch (error) {
        console.error('Error adding surah to queue:', error);
      }
    },
    [reciter, selectedRewayat, addToQueue],
  );

  // Create a custom isLoved function that checks for the specific rewayatId
  const isLovedWithCurrentRewayat = useCallback(
    (id: string, surahId: string | number) => {
      if (!selectedRewayat) return false;
      return isLovedWithRewayat(id, surahId, selectedRewayat.id);
    },
    [isLovedWithRewayat, selectedRewayat],
  );

  // Function to sort rewayat, prioritizing Murattal Hafs A'n Assem
  const sortRewayat = (rewayat: Rewayat[]): Rewayat[] => {
    return [...rewayat].sort((a, b) => {
      // First priority: Hafs A'n Assem with murattal style
      const aIsHafsMurattal =
        a.name === "Hafs A'n Assem" && a.style === 'murattal';
      const bIsHafsMurattal =
        b.name === "Hafs A'n Assem" && b.style === 'murattal';

      if (aIsHafsMurattal && !bIsHafsMurattal) return -1;
      if (!aIsHafsMurattal && bIsHafsMurattal) return 1;

      // Second priority: Any Hafs A'n Assem
      const aIsHafs = a.name === "Hafs A'n Assem";
      const bIsHafs = b.name === "Hafs A'n Assem";

      if (aIsHafs && !bIsHafs) return -1;
      if (!aIsHafs && bIsHafs) return 1;

      // Third priority: Any murattal style
      const aIsMurattal = a.style === 'murattal';
      const bIsMurattal = b.style === 'murattal';

      if (aIsMurattal && !bIsMurattal) return -1;
      if (!aIsMurattal && bIsMurattal) return 1;

      return 0;
    });
  };

  // Callback to toggle view mode with optimized performance
  const toggleViewMode = useCallback(() => {
    const newMode = viewMode === 'card' ? 'list' : 'card';
    // First update settings store to avoid state sync issues
    setReciterViewModeSetting(newMode);
    // Then update local state
    setViewMode(newMode);

    // Schedule scroll restoration after view mode change is applied
    requestAnimationFrame(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({
          offset: scrollPosition.current,
          animated: false,
        });
      }
    });
  }, [viewMode, setReciterViewModeSetting, scrollPosition]);

  // Callback to change sort option
  const changeSortOption = useCallback(
    (option: ReciterProfileSortOption) => {
      setSortOption(option);
      setReciterSortOptionSetting(option);
    },
    [setReciterSortOptionSetting],
  );

  // Function to generate a consistent color for each surah (similar to browse-all)
  const getColorForSurah = useCallback((id: number): string => {
    const colors = [
      '#059669',
      '#7C3AED',
      '#1E40AF',
      '#DC2626',
      '#EA580C',
      '#0891B2',
      '#BE185D',
      '#4F46E5',
      '#B45309',
      '#047857',
    ];
    return colors[id % colors.length];
  }, []);

  // Add shared value for heart animation
  const heartScale = useSharedValue(1);

  // Create animated style for heart
  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: heartScale.value}],
  }));

  // Callback to toggle loved filter with animation
  const toggleShowLovedOnly = useCallback(() => {
    setShowLovedOnly(prev => !prev);
    // Animate the heart
    heartScale.value = withSpring(1.2, {damping: 10, stiffness: 300}, () => {
      heartScale.value = withSpring(1);
    });
  }, [heartScale]);

  // Create a stable reference to data and callbacks used by SurahList to prevent re-renders
  const surahListProps = useMemo(
    () => ({
      surahs: filteredSurahs,
      onSurahPress: handleSurahPress,
      reciterId: currentReciterId,
      isLoved: isLovedWithCurrentRewayat,
      isDownloaded: isDownloaded,
      onOptionsPress: (surah: Surah) =>
        showSurahOptions(
          surah,
          currentReciterId,
          handleAddToQueue,
          selectedRewayat?.id,
        ),
      onScroll: handleScroll,
      viewMode,
      sortOption,
      getColorForSurah,
      rewayatId: selectedRewayat?.id,
      maintainVisibleContentPosition: {
        minIndexForVisible: 0,
        autoscrollToTopThreshold: 10,
      },
    }),
    [
      filteredSurahs,
      handleSurahPress,
      currentReciterId,
      isLovedWithCurrentRewayat,
      isDownloaded,
      showSurahOptions,
      handleAddToQueue,
      selectedRewayat?.id,
      handleScroll,
      viewMode,
      sortOption,
      getColorForSurah,
    ],
  );

  if (!reciter || isLoadingColors || !isImagePreloaded) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar
          style={theme.isDarkMode ? 'light' : 'dark'}
          translucent
          backgroundColor="transparent"
        />
        <LoadingIndicator />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        style={theme.isDarkMode ? 'light' : isStatusBarDark ? 'light' : 'dark'}
        translucent
        backgroundColor="transparent"
      />
      {showSearch ? (
        <SearchView
          surahs={filteredSurahs}
          onSurahPress={handleSurahPress}
          reciterId={currentReciterId}
          isLoved={isLovedWithCurrentRewayat}
          onOptionsPress={(surah: Surah) =>
            showSurahOptions(
              surah,
              currentReciterId,
              handleAddToQueue,
              selectedRewayat?.id,
            )
          }
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          onCloseSearch={() => {
            setShowSearch(false);
            setSearchQuery('');
          }}
          availableRewayat={rewayatList}
          selectedRewayatId={selectedRewayatId}
          onRewayatSelect={handleRewayatChange}
          dominantColors={dominantColors}
          isDarkMode={theme.isDarkMode}
          reciterName={reciter.name}
          viewMode={viewMode}
          getColorForSurah={getColorForSurah}
        />
      ) : (
        <>
          <MemoizedSurahList
            ref={flatListRef}
            {...surahListProps}
            ListHeaderComponent={
              <>
                <ReciterHeader
                  reciter={reciter}
                  selectedRewayatId={selectedRewayatId}
                  onRewayatInfoPress={handleRewayatInfoPress}
                  showSearch={showSearch}
                  insets={insets}
                  canEditImage={reciter.isLocal}
                  onEditImage={handleEditImage}
                />
                {reciter.isLocal && (
                  <View style={styles.localActionsRow}>
                    <TouchableOpacity
                      style={styles.localActionButton}
                      onPress={openEditReciterModal}>
                      <Text style={styles.localActionText}>Edit reciter</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.contentContainer}>
                  <ActionButtons
                    onFavoritePress={handleToggleFavorite}
                    onShufflePress={handleShuffleAll}
                    onPlayPress={handlePlayAll}
                    isFavoriteReciter={isFavoriteReciter(reciter.id)}
                  />
                  <View style={styles.optionsAndToggleRow}>
                    {/* Sort options (Left side) */}
                    <View style={styles.sortOptionsContainer}>
                      <TouchableOpacity
                        style={[
                          styles.optionButton,
                          sortOption === 'asc' && styles.activeOptionButton,
                        ]}
                        activeOpacity={1}
                        onPress={() => changeSortOption('asc')}>
                        <Icon
                          name="arrow-up"
                          type="feather"
                          size={moderateScale(14)}
                          color={
                            sortOption === 'asc'
                              ? theme.colors.primary
                              : theme.colors.textSecondary
                          }
                        />
                        <Text
                          style={[
                            styles.optionButtonText,
                            sortOption === 'asc' && styles.activeOptionText,
                          ]}>
                          Asc
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.optionButton,
                          sortOption === 'desc' && styles.activeOptionButton,
                        ]}
                        activeOpacity={1}
                        onPress={() => changeSortOption('desc')}>
                        <Icon
                          name="arrow-down"
                          type="feather"
                          size={moderateScale(14)}
                          color={
                            sortOption === 'desc'
                              ? theme.colors.primary
                              : theme.colors.textSecondary
                          }
                        />
                        <Text
                          style={[
                            styles.optionButtonText,
                            sortOption === 'desc' && styles.activeOptionText,
                          ]}>
                          Desc
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.optionButton,
                          sortOption === 'revelation' &&
                            styles.activeOptionButton,
                        ]}
                        activeOpacity={1}
                        onPress={() => changeSortOption('revelation')}>
                        <Icon
                          name="calendar"
                          type="feather"
                          size={moderateScale(14)}
                          color={
                            sortOption === 'revelation'
                              ? theme.colors.primary
                              : theme.colors.textSecondary
                          }
                        />
                        <Text
                          style={[
                            styles.optionButtonText,
                            sortOption === 'revelation' &&
                              styles.activeOptionText,
                          ]}>
                          Rev
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Right side controls (Heart + View Toggle) */}
                    <View style={styles.rightControlsContainer}>
                      {/* Heart (Loved) Filter Button */}
                      <TouchableOpacity
                        style={[
                          styles.optionButton,
                          {
                            marginRight: moderateScale(15),
                            marginTop: moderateScale(4),
                          },
                        ]}
                        activeOpacity={1}
                        onPress={toggleShowLovedOnly}>
                        <Animated.View style={heartAnimatedStyle}>
                          <HeartIcon
                            size={moderateScale(22)}
                            color={
                              showLovedOnly
                                ? theme.colors.error
                                : theme.colors.textSecondary
                            }
                            filled={true}
                          />
                        </Animated.View>
                      </TouchableOpacity>

                      {/* View mode toggle */}
                      <TouchableOpacity
                        style={styles.viewModeButton}
                        onPress={toggleViewMode}
                        activeOpacity={1}>
                        <Icon
                          name={viewMode === 'card' ? 'list' : 'grid'}
                          type="feather"
                          size={moderateScale(16)}
                          color={theme.colors.text}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </>
            }
          />
          {renderEditModal()}
          <StickyHeader
            reciterName={reciter.name}
            headerOpacity={headerOpacity}
            insets={insets}
            dominantColors={dominantColors}
            isDarkMode={theme.isDarkMode}
          />
          <NavigationButtons
            insets={insets}
            iconsOpacity={iconsOpacity}
            iconsZIndex={iconsZIndex}
            scrollY={scrollY}
            onSearchPress={() => {
              setShowSearch(true);
            }}
          />
        </>
      )}
    </View>
  );
};

export default ReciterProfile;
