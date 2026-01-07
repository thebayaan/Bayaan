import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import {useLocalRecitersStore} from '@/store/localRecitersStore';
import {useTheme} from '@/hooks/useTheme';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Icon} from '@rneui/themed';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import BottomSheet from '@gorhom/bottom-sheet';
import {BaseModal} from './BaseModal';

interface AddReciterModalProps {
  visible: boolean;
  onClose: () => void;
  bottomSheetRef?: React.RefObject<BottomSheet>; // Add optional ref prop
}

export const AddReciterModal: React.FC<AddReciterModalProps> = ({
  visible,
  onClose,
  bottomSheetRef: externalRef, // Receive external ref
}) => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const {addLocalReciter} = useLocalRecitersStore();
  
  // Use external ref if provided, otherwise create internal one
  const internalRef = useRef<BottomSheet>(null);
  const bottomSheetRef = externalRef || internalRef;

  const [name, setName] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [stylesList, setStylesList] = useState<{name: string; id: string}[]>([
    {name: 'Murattal', id: Crypto.randomUUID()},
  ]);
  const [newStyleName, setNewStyleName] = useState('');

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      // Use setTimeout to ensure ref is ready and animation is smooth
      setTimeout(() => {
        bottomSheetRef.current?.expand();
      }, 50);
      
      // Reset form when opening
      setName('');
      setImageUri(null);
      setStylesList([{name: 'Murattal', id: Crypto.randomUUID()}]);
      setNewStyleName('');
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible, bottomSheetRef]);

  const handleSheetChange = (index: number) => {
    if (index === -1) {
      onClose();
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const addStyle = () => {
    if (newStyleName.trim()) {
      setStylesList([
        ...stylesList,
        {name: newStyleName.trim(), id: Crypto.randomUUID()},
      ]);
      setNewStyleName('');
    }
  };

  const removeStyle = (id: string) => {
    setStylesList(stylesList.filter(s => s.id !== id));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a reciter name');
      return;
    }

    if (stylesList.length === 0) {
      Alert.alert(
        'Error',
        'Please add at least one recitation style (e.g. Murattal)',
      );
      return;
    }

    try {
      const id = Crypto.randomUUID();
      let savedImageUri: string | null = null;

      // Create reciter directory
      const reciterDir = `${FileSystem.documentDirectory}reciters/${id}/`;
      await FileSystem.makeDirectoryAsync(reciterDir, {intermediates: true});

      if (imageUri) {
        // Save image to permanent storage
        const fileName = `${id}-profile.jpg`;
        const newPath = `${reciterDir}${fileName}`;
        await FileSystem.copyAsync({
          from: imageUri,
          to: newPath,
        });
        savedImageUri = newPath;
      }

      // Create rewayat objects for each style
      const rewayat = stylesList.map(style => ({
        id: style.id,
        reciter_id: id,
        name: style.name,
        style: 'murattal', // Internal type
        server: `file://${reciterDir}`, // Base path for audio files
        surah_total: 0,
        surah_list: [],
        source_type: 'local',
        created_at: new Date().toISOString(),
        isLocal: true,
        fileExtension: 'mp3',
      }));

      addLocalReciter({
        id,
        name: name.trim(),
        date: new Date().toISOString(),
        image_url: savedImageUri,
        rewayat: rewayat,
        isLocal: true,
      });

      onClose();
    } catch (error) {
      console.error('Error saving reciter:', error);
      Alert.alert('Error', 'Failed to save reciter');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      // backgroundColor: theme.colors.background, // Handled by BaseModal
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: moderateScale(16),
      // borderBottomWidth: 1,
      // borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: moderateScale(20),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      marginLeft: moderateScale(12),
    },
    content: {
      padding: moderateScale(20),
      paddingBottom: insets.bottom + moderateScale(32),
    },
    imageContainer: {
      alignSelf: 'center',
      marginBottom: verticalScale(24),
    },
    imagePlaceholder: {
      width: moderateScale(120),
      height: moderateScale(120),
      borderRadius: moderateScale(60),
      backgroundColor: theme.colors.card,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: 'dashed',
    },
    image: {
      width: moderateScale(120),
      height: moderateScale(120),
      borderRadius: moderateScale(60),
    },
    imageLabel: {
      marginTop: verticalScale(8),
      fontSize: moderateScale(14),
      color: theme.colors.primary,
      textAlign: 'center',
    },
    sectionTitle: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
      marginTop: verticalScale(16),
      marginBottom: verticalScale(8),
      fontWeight: '600',
    },
    input: {
      backgroundColor: theme.colors.card,
      borderRadius: moderateScale(12),
      padding: moderateScale(12),
      fontSize: moderateScale(16),
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: verticalScale(16),
    },
    addStyleContainer: {
      flexDirection: 'row',
      gap: moderateScale(8),
      marginBottom: verticalScale(16),
    },
    addStyleInput: {
      flex: 1,
      marginBottom: 0,
    },
    addButton: {
      backgroundColor: theme.colors.card,
      borderRadius: moderateScale(12),
      paddingHorizontal: moderateScale(16),
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    styleItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.card,
      padding: moderateScale(12),
      borderRadius: moderateScale(8),
      marginBottom: verticalScale(8),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    styleName: {
      fontSize: moderateScale(14),
      color: theme.colors.text,
    },
    saveButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: moderateScale(12),
      padding: moderateScale(16),
      alignItems: 'center',
      marginTop: verticalScale(24),
      marginBottom: verticalScale(24),
    },
    saveButtonText: {
      color: '#fff',
      fontSize: moderateScale(16),
      fontWeight: 'bold',
    },
  });

  return (
    <BaseModal
      bottomSheetRef={bottomSheetRef}
      snapPoints={['95%']}
      onChange={handleSheetChange}
      title="">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Add New Reciter</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          bounces={false}
          showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
            {imageUri ? (
              <Image source={{uri: imageUri}} style={styles.image} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Icon
                  name="camera"
                  type="feather"
                  color={theme.colors.textSecondary}
                  size={32}
                />
              </View>
            )}
            <Text style={styles.imageLabel}>
              {imageUri ? 'Change Photo' : 'Add Photo'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Reciter Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter name"
            placeholderTextColor={theme.colors.textSecondary}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.sectionTitle}>Recitation Styles (Tabs)</Text>
          <View style={styles.addStyleContainer}>
            <TextInput
              style={[styles.input, styles.addStyleInput]}
              placeholder="E.g. Hafs, Warsh, Studio"
              placeholderTextColor={theme.colors.textSecondary}
              value={newStyleName}
              onChangeText={setNewStyleName}
            />
            <TouchableOpacity style={styles.addButton} onPress={addStyle}>
              <Icon
                name="plus"
                type="feather"
                size={20}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          </View>

          {stylesList.map(style => (
            <View key={style.id} style={styles.styleItem}>
              <Text style={styles.styleName}>{style.name}</Text>
              <TouchableOpacity onPress={() => removeStyle(style.id)}>
                <Icon
                  name="trash-2"
                  type="feather"
                  size={18}
                  color={theme.colors.error || 'red'}
                />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Create Reciter</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </BaseModal>
  );
};

export default AddReciterModal;

