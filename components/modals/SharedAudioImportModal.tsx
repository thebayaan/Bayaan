import React, {useEffect, useMemo, useRef, useState, useCallback} from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import AudioShare from 'expo-audio-share-receiver';
import {useTheme} from '@/hooks/useTheme';
import {BaseModal} from '@/components/modals/BaseModal';
import {Button} from '@/components/Button';
import {Input} from '@/components/Input';
import {SURAHS} from '@/data/surahData';
import {useLocalRecitersStore} from '@/store/localRecitersStore';
import {Rewayat} from '@/data/reciterData';
import {replaceAudioFile} from '@/services/downloadService';
import {moderateScale} from 'react-native-size-matters';
import Animated, {FadeIn, FadeOut, Layout, SlideInRight, SlideOutLeft} from 'react-native-reanimated';

type SharedAudioFile = {path: string};

interface FileMapping {
  id: string;
  path: string;
  fileName: string;
  surahId: number | null;
  rewayaId: string | null;
}

interface SharedAudioImportModalProps {
  visible: boolean;
  files: SharedAudioFile[];
  onClose: () => void;
  onAddReciter: () => void;
}

const getFileName = (path: string) => {
  const cleaned = path.split('?')[0];
  return cleaned.split('/').pop() || 'audio';
};

const getFileExtension = (fileName: string) => {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : 'mp3';
};

export const SharedAudioImportModal: React.FC<SharedAudioImportModalProps> = ({
  visible,
  files,
  onClose,
  onAddReciter,
}) => {
  const {theme} = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const localReciters = useLocalRecitersStore(state => state.localReciters);
  const updateLocalReciter = useLocalRecitersStore(state => state.updateLocalReciter);

  const [selectedReciterId, setSelectedReciterId] = useState<string | null>(null);
  const [mappings, setMappings] = useState<FileMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingSurahId, setEditingSurahId] = useState<string | null>(null);
  const [editingRewayaId, setEditingRewayaId] = useState<string | null>(null);

  const selectedReciter = useMemo(
    () => localReciters.find(r => r.id === selectedReciterId) || null,
    [localReciters, selectedReciterId],
  );

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        bottomSheetRef.current?.expand();
      }, 50);
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const initialMappings = files.map(file => ({
      id: Crypto.randomUUID(),
      path: file.path,
      fileName: getFileName(file.path),
      surahId: null,
      rewayaId: null,
    }));
    setMappings(initialMappings);
  }, [files, visible]);

  useEffect(() => {
    if (!selectedReciter) return;
    if (selectedReciter.rewayat.length === 1) {
      const onlyId = selectedReciter.rewayat[0].id;
      setMappings(prev =>
        prev.map(mapping => ({
          ...mapping,
          rewayaId: onlyId,
        })),
      );
    } else {
      setMappings(prev =>
        prev.map(mapping => ({
          ...mapping,
          rewayaId: null,
        })),
      );
    }
  }, [selectedReciter]);

  const handleClose = useCallback(() => {
    setSelectedReciterId(null);
    setMappings([]);
    setEditingSurahId(null);
    setEditingRewayaId(null);
    onClose();
  }, [onClose]);

  const updateSurah = (mappingId: string, surahId: number | null) => {
    setMappings(prev =>
      prev.map(mapping =>
        mapping.id === mappingId ? {...mapping, surahId} : mapping,
      ),
    );
  };

  const updateRewaya = (mappingId: string, rewayaId: string | null) => {
    setMappings(prev =>
      prev.map(mapping =>
        mapping.id === mappingId ? {...mapping, rewayaId} : mapping,
      ),
    );
  };

  const readyCount = useMemo(
    () =>
      mappings.filter(mapping => mapping.surahId && mapping.rewayaId).length,
    [mappings],
  );

  const handleImport = useCallback(async () => {
    if (!selectedReciter) {
      Alert.alert('Select Reciter', 'Please select a local reciter.');
      return;
    }

    const incomplete = mappings.filter(
      mapping => !mapping.surahId || !mapping.rewayaId,
    );
    if (incomplete.length > 0) {
      Alert.alert(
        'Missing Info',
        'Please select a rewaya and surah for every file.',
      );
      return;
    }

    setLoading(true);
    try {
      const rewayaUpdates = new Map<
        string,
        {surahIds: Set<number>; fileExtension?: string}
      >();

      for (const mapping of mappings) {
        const rewaya = selectedReciter.rewayat.find(
          r => r.id === mapping.rewayaId,
        );
        if (!rewaya || !mapping.surahId) continue;

        const baseDir = rewaya.server.replace('file://', '');
        const destDir = baseDir.endsWith('/') ? baseDir : `${baseDir}/`;
        await FileSystem.makeDirectoryAsync(destDir, {intermediates: true});

        const extension = getFileExtension(mapping.fileName);
        const paddedSurahId = mapping.surahId.toString().padStart(3, '0');
        const destPath = `${destDir}${paddedSurahId}.${extension}`;
        const existing = await FileSystem.getInfoAsync(destPath);

        if (existing.exists) {
          await replaceAudioFile(destPath, mapping.path);
        } else {
          await FileSystem.copyAsync({from: mapping.path, to: destPath});
        }

        const update = rewayaUpdates.get(rewaya.id) || {
          surahIds: new Set<number>(),
        };
        update.surahIds.add(mapping.surahId);
        if (!update.fileExtension) {
          update.fileExtension = extension;
        }
        rewayaUpdates.set(rewaya.id, update);

        try {
          await FileSystem.deleteAsync(mapping.path, {idempotent: true});
        } catch (error) {
          console.warn('[SharedAudioImport] Failed to delete shared file', error);
        }
      }

      const updatedReciter = {
        ...selectedReciter,
        rewayat: selectedReciter.rewayat.map(rewaya => {
          const update = rewayaUpdates.get(rewaya.id);
          if (!update) return rewaya;
          const existingIds = new Set(
            (rewaya.surah_list || []).filter(
              (id): id is number => id !== null,
            ),
          );
          update.surahIds.forEach(id => existingIds.add(id));
          return {
            ...rewaya,
            surah_list: Array.from(existingIds).sort((a, b) => a - b),
            surah_total: existingIds.size,
            fileExtension: update.fileExtension || rewaya.fileExtension,
          };
        }),
      };

      updateLocalReciter(updatedReciter);

      // Clear any remaining shared files from the App Group container
      try {
        await AudioShare.clearSharedFiles();
      } catch (err) {
        console.warn('[SharedAudioImport] Failed to clear shared files', err);
      }

      Alert.alert('Success', `Imported ${readyCount} file(s).`);
      handleClose();
    } catch (error) {
      console.error('[SharedAudioImport] Import failed', error);
      Alert.alert('Error', 'Failed to import shared audio files.');
    } finally {
      setLoading(false);
    }
  }, [handleClose, mappings, readyCount, selectedReciter, updateLocalReciter]);

  const styles = StyleSheet.create({
    sectionTitle: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      marginBottom: moderateScale(8),
    },
    reciterCard: {
      padding: moderateScale(12),
      borderRadius: moderateScale(12),
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: moderateScale(8),
      backgroundColor: theme.colors.card,
    },
    reciterCardSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.backgroundSecondary,
    },
    reciterName: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    helperText: {
      fontSize: moderateScale(13),
      color: theme.colors.textSecondary,
      marginBottom: moderateScale(12),
    },
    fileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(10),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: moderateScale(8),
    },
    fileName: {
      flex: 1,
      fontSize: moderateScale(13),
      color: theme.colors.text,
      fontFamily: 'Manrope-Regular',
    },
    pickerButton: {
      paddingVertical: moderateScale(6),
      paddingHorizontal: moderateScale(10),
      borderRadius: moderateScale(8),
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minWidth: moderateScale(90),
      alignItems: 'center',
    },
    pickerText: {
      fontSize: moderateScale(12),
      color: theme.colors.textSecondary,
    },
    pickerTextSelected: {
      color: theme.colors.primary,
      fontFamily: 'Manrope-Medium',
    },
    footer: {
      paddingTop: moderateScale(12),
    },
  });

  const renderReciterSelection = () => (
    <View>
      <Text style={styles.sectionTitle}>Choose local reciter</Text>
      {localReciters.length === 0 ? (
        <Text style={styles.helperText}>
          No local reciters yet. Create one to import audio.
        </Text>
      ) : (
        localReciters.map(reciter => (
          <TouchableOpacity
            key={reciter.id}
            style={[
              styles.reciterCard,
              reciter.id === selectedReciterId && styles.reciterCardSelected,
            ]}
            onPress={() => setSelectedReciterId(reciter.id)}
            activeOpacity={0.8}>
            <Text style={styles.reciterName}>{reciter.name}</Text>
          </TouchableOpacity>
        ))
      )}
      <Button title="Add New Reciter" onPress={onAddReciter} />
    </View>
  );

  const renderFileRow = ({item}: {item: FileMapping}) => {
    const selectedSurah = item.surahId
      ? SURAHS.find(surah => surah.id === item.surahId)
      : null;
    const selectedRewaya = selectedReciter?.rewayat.find(
      rewaya => rewaya.id === item.rewayaId,
    );

    return (
      <Animated.View
        style={styles.fileRow}
        layout={Layout.springify()}
        entering={FadeIn}
        exiting={FadeOut}>
        <Text style={styles.fileName} numberOfLines={1}>
          {item.fileName}
        </Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setEditingRewayaId(item.id)}
          disabled={!selectedReciter}>
          <Text
            style={[
              styles.pickerText,
              selectedRewaya && styles.pickerTextSelected,
            ]}>
            {selectedRewaya ? selectedRewaya.name : 'Rewaya'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setEditingSurahId(item.id)}>
          <Text
            style={[
              styles.pickerText,
              selectedSurah && styles.pickerTextSelected,
            ]}>
            {selectedSurah
              ? `${selectedSurah.id}. ${selectedSurah.name}`
              : 'Surah'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderSurahPicker = () => {
    if (!editingSurahId) return null;
    return (
      <SurahPicker
        onSelect={surahId => {
          updateSurah(editingSurahId, surahId);
          setEditingSurahId(null);
        }}
        onClose={() => setEditingSurahId(null)}
        theme={theme}
      />
    );
  };

  const renderRewayaPicker = () => {
    if (!editingRewayaId) return null;
    return (
      <RewayaPicker
        rewayat={selectedReciter?.rewayat || []}
        onSelect={rewayaId => {
          updateRewaya(editingRewayaId, rewayaId);
          setEditingRewayaId(null);
        }}
        onClose={() => setEditingRewayaId(null)}
        theme={theme}
      />
    );
  };

  return (
    <BaseModal
      bottomSheetRef={bottomSheetRef}
      snapPoints={['85%']}
      title="Import Shared Audio"
      onChange={index => {
        if (index === -1) {
          handleClose();
        }
      }}>
      <View>
        {renderReciterSelection()}
        <View style={{marginTop: moderateScale(16)}}>
          <Text style={styles.sectionTitle}>Assign each file</Text>
          <Text style={styles.helperText}>
            Choose a rewaya and surah for every shared file.
          </Text>
          <FlatList
            data={mappings}
            keyExtractor={item => item.id}
            renderItem={renderFileRow}
            contentContainerStyle={{paddingBottom: moderateScale(12)}}
          />
          <View style={styles.footer}>
            <Button
              title={`Import ${readyCount} file(s)`}
              onPress={handleImport}
              disabled={loading || readyCount === 0}
            />
          </View>
        </View>
      </View>
      {renderSurahPicker()}
      {renderRewayaPicker()}
    </BaseModal>
  );
};

const SurahPicker = ({
  onSelect,
  onClose,
  theme,
}: {
  onSelect: (id: number | null) => void;
  onClose: () => void;
  theme: any;
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSurahs = useMemo(() => {
    if (!searchQuery) return SURAHS;
    const lower = searchQuery.toLowerCase();
    return SURAHS.filter(
      surah =>
        surah.name.toLowerCase().includes(lower) ||
        surah.translated_name_english.toLowerCase().includes(lower) ||
        surah.id.toString() === lower,
    );
  }, [searchQuery]);

  return (
    <Animated.View
      entering={SlideInRight}
      exiting={SlideOutLeft}
      style={[
        StyleSheet.absoluteFill,
        {backgroundColor: theme.colors.background, padding: moderateScale(16)},
      ]}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: moderateScale(12),
        }}>
        <Text style={{color: theme.colors.text, fontFamily: 'Manrope-Bold'}}>
          Select Surah
        </Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={{color: theme.colors.primary}}>Close</Text>
        </TouchableOpacity>
      </View>
      <Input
        placeholder="Search surah..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        containerStyle={{marginBottom: moderateScale(8)}}
        showIcon
        iconName="search"
      />
      <FlatList
        data={filteredSurahs}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={() => (
          <TouchableOpacity
            onPress={() => onSelect(null)}
            style={{
              paddingVertical: moderateScale(12),
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}>
            <Text style={{color: theme.colors.textSecondary}}>Unassign</Text>
          </TouchableOpacity>
        )}
        renderItem={({item}) => (
          <TouchableOpacity
            onPress={() => onSelect(item.id)}
            style={{
              paddingVertical: moderateScale(12),
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}>
            <Text style={{color: theme.colors.text}}>
              {item.id}. {item.name} - {item.translated_name_english}
            </Text>
          </TouchableOpacity>
        )}
      />
    </Animated.View>
  );
};

const RewayaPicker = ({
  rewayat,
  onSelect,
  onClose,
  theme,
}: {
  rewayat: Rewayat[];
  onSelect: (id: string | null) => void;
  onClose: () => void;
  theme: any;
}) => {
  return (
    <Animated.View
      entering={SlideInRight}
      exiting={SlideOutLeft}
      style={[
        StyleSheet.absoluteFill,
        {backgroundColor: theme.colors.background, padding: moderateScale(16)},
      ]}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: moderateScale(12),
        }}>
        <Text style={{color: theme.colors.text, fontFamily: 'Manrope-Bold'}}>
          Select Rewaya
        </Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={{color: theme.colors.primary}}>Close</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={rewayat}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <TouchableOpacity
            onPress={() => onSelect(item.id)}
            style={{
              paddingVertical: moderateScale(12),
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}>
            <Text style={{color: theme.colors.text}}>{item.name}</Text>
            <Text style={{color: theme.colors.textSecondary, fontSize: 12}}>
              {item.style}
            </Text>
          </TouchableOpacity>
        )}
      />
    </Animated.View>
  );
};

export default SharedAudioImportModal;

