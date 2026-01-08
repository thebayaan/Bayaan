import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import BottomSheet, {BottomSheetView} from '@gorhom/bottom-sheet';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Updates from 'expo-updates';
import {Icon} from '@rneui/themed';
import {useTheme} from '@/hooks/useTheme';
import {BaseModal} from './BaseModal';
import {SURAHS, Surah} from '@/data/surahData';
import {Button} from '@/components/Button';
import {useLocalRecitersStore} from '@/store/localRecitersStore';
import {replaceAudioFile} from '@/services/downloadService';
import {matchSurahFromFileName} from '@/services/surahBloom';

import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  Layout,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// Animated components
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedView = Animated.createAnimatedComponent(View);

import {LinearGradient} from 'expo-linear-gradient';
import {Input} from '@/components/Input';

interface BulkUploadModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  reciterId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FileMapping {
  id: string; // unique internal id for list
  file: DocumentPicker.DocumentPickerAsset;
  surahId: number | null; // The assigned surah
  status: 'pending' | 'matched' | 'duplicate' | 'error';
}

type AssignmentMode = 'smart' | 'sequential' | 'manual';

export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({
  bottomSheetRef,
  reciterId,
  onClose,
  onSuccess,
}) => {
  const {theme} = useTheme();
  const {bulkAddSurahsToReciter} = useLocalRecitersStore();

  const [step, setStep] = useState<'pick' | 'mode' | 'review' | 'uploading'>('pick');
  const [files, setFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [mappings, setMappings] = useState<FileMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({current: 0, total: 0});
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  
  const snapPoints = useMemo(() => {
    switch(step) {
      case 'pick': return ['40%'];
      case 'mode': return ['55%']; // Smaller as requested
      case 'uploading': return ['40%'];
      case 'review': 
      default: return ['90%'];
    }
  }, [step]);
  
  // Reset state when modal opens/closes if needed, but BaseModal handles mounting usually.
  
    const removeMapping = (id: string) => {
        setMappings(prev => {
            const newMappings = prev.filter(m => m.id !== id);
            // Also update the source files list to stay in sync if we switch modes
            const mappingToRemove = prev.find(m => m.id === id);
            if (mappingToRemove) {
                setFiles(currentFiles => currentFiles.filter(f => f.uri !== mappingToRemove.file.uri));
            }
            return newMappings;
        });
    };

    const handlePickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFiles(result.assets);
        setStep('mode');
      }
    } catch (err) {
      console.error('Error picking files:', err);
      Alert.alert('Error', 'Failed to pick files');
    }
  };

  const applyMapping = (mode: AssignmentMode) => {
    let newMappings: FileMapping[] = [];
    
    // Sort files alphabetically for sequential, or keep original order
    // Sequential implies alphabetical usually.
    let sortedFiles = [...files];
    if (mode === 'sequential') {
      sortedFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));
    }

    const usedSurahIds = new Set<number>();

    newMappings = sortedFiles.map((file, index) => {
      let surahId: number | null = null;

      if (mode === 'sequential') {
        const potentialId = index + 1;
        if (potentialId <= 114 && !usedSurahIds.has(potentialId)) {
            surahId = potentialId;
        }
      } else if (mode === 'smart') {
        // Smart matching logic using Bloom filters + Exact Match
        // Uses precomputed filters and index for O(1) matching accuracy
        const bloomMatch = matchSurahFromFileName(file.name);
        
        if (bloomMatch) {
          surahId = bloomMatch;
        }

        // Check for duplicates
        if (surahId && usedSurahIds.has(surahId)) {
            surahId = null;
        }
      } else {
        // Manual: all null
        surahId = null;
      }

      if (surahId) {
        usedSurahIds.add(surahId);
      }

      return {
        id: Math.random().toString(36).substring(7),
        file,
        surahId,
        status: surahId ? 'matched' : 'pending',
      };
    });

    setMappings(newMappings);
    setStep('review');
  };

  const updateMapping = (id: string, surahId: number | null) => {
    setMappings(prev => prev.map(m => 
      m.id === id ? {...m, surahId, status: surahId ? 'matched' : 'pending'} : m
    ));
  };

  const validateMappings = () => {
    // Check for duplicates
    const surahCounts = new Map<number, number>();
    mappings.forEach(m => {
        if (m.surahId) {
            surahCounts.set(m.surahId, (surahCounts.get(m.surahId) || 0) + 1);
        }
    });

    const hasDuplicates = Array.from(surahCounts.values()).some(count => count > 1);
    if (hasDuplicates) {
        Alert.alert('Warning', 'You have multiple files assigned to the same Surah. Please fix duplicates.');
        return false;
    }
    
    // Check if any unassigned? Optional, maybe user wants to upload partial.
    // But usually better to warn.
    return true;
  };

  const handleSave = async () => {
    if (!validateMappings()) return;

    setLoading(true);
    setStep('uploading');
    setUploadProgress({current: 0, total: mappings.filter(m => m.surahId).length});

    try {
        const validMappings = mappings.filter(m => m.surahId !== null);
        const newSurahIds: number[] = [];
        const reciterDir = `${FileSystem.documentDirectory}reciters/${reciterId}/`;
        
        // Ensure directory exists
        await FileSystem.makeDirectoryAsync(reciterDir, {intermediates: true});

        let processed = 0;
        let extensionForStore: string | null = null;

        for (const mapping of validMappings) {
            if (!mapping.surahId) continue;

            const extension = mapping.file.name.split('.').pop() || 'mp3';
            const paddedSurahId = mapping.surahId.toString().padStart(3, '0');
            const destPath = `${reciterDir}${paddedSurahId}.${extension}`;

            const existing = await FileSystem.getInfoAsync(destPath);

            if (existing.exists) {
                // Update existing audio using the same logic as single update
                await replaceAudioFile(destPath, mapping.file.uri);
            } else {
                // Add new audio
                await FileSystem.copyAsync({
                    from: mapping.file.uri,
                    to: destPath,
                });
                newSurahIds.push(mapping.surahId);
                if (!extensionForStore) {
                    extensionForStore = extension;
                }
            }

            processed++;
            setUploadProgress({current: processed, total: validMappings.length});
        }

        // Update store only for newly added surahs
        if (newSurahIds.length > 0) {
            bulkAddSurahsToReciter(reciterId, newSurahIds, extensionForStore || 'mp3');
        }
        
        Alert.alert('Success', `Uploaded ${processed} files successfully.`);
        onSuccess?.();
        // Force a full app reload to ensure fresh state everywhere
        try {
          await Updates.reloadAsync();
        } catch (e) {
          console.error('Failed to reload app after bulk upload', e);
          onClose();
        }
        
        // Reset
        setFiles([]);
        setMappings([]);
        setStep('pick');

    } catch (error) {
        console.error('Bulk upload error:', error);
        Alert.alert('Error', 'Failed to save files.');
        setStep('review');
    } finally {
        setLoading(false);
    }
  };

  // Render helpers
  const renderModeSelection = () => (
    <View style={styles.modeContainer}>
      <Text style={[styles.subtitle, {color: theme.colors.text}]}>
        Found {files.length} files. How should we assign them?
      </Text>
      
      <SmartMatchButton 
        onPress={() => applyMapping('smart')}
        theme={theme}
        delay={100}
      />

      <AnimatedButton 
        onPress={() => applyMapping('sequential')}
        theme={theme}
        icon="sort-by-alpha"
        title="Sequential"
        description="Assign 1 to N in alphabetical order"
        delay={200}
      />

      <AnimatedButton 
        onPress={() => applyMapping('manual')}
        theme={theme}
        icon="edit"
        title="Manual"
        description="Select Surahs one by one"
        delay={300}
      />

      <View style={{marginTop: 10, alignItems: 'center'}}>
        <TouchableOpacity onPress={() => { setFiles([]); setMappings([]); setStep('pick'); }}>
            <Text style={{color: theme.colors.textSecondary, fontFamily: 'Manrope-Medium', textDecorationLine: 'underline'}}>
                Go back & reselect files
            </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderReview = () => (
    <View style={{flex: 1}}>
       <View style={styles.headerControls}>
          <Text style={[styles.statsText, {color: theme.colors.textSecondary}]}>
            {mappings.filter(m => m.surahId).length} / {mappings.length} assigned
          </Text>
          <TouchableOpacity onPress={() => setStep('mode')}>
            <Text style={{color: theme.colors.primary, fontFamily: 'Manrope-Bold'}}>Change Mode</Text>
          </TouchableOpacity>
       </View>

       <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10, gap: 15}}>
          <TouchableOpacity onPress={() => { setFiles([]); setMappings([]); setStep('pick'); }}>
             <Text style={{color: theme.colors.error, fontFamily: 'Manrope-Medium', fontSize: moderateScale(12)}}>Reset All</Text>
          </TouchableOpacity>
       </View>

       <FlatList 
         data={mappings}
         keyExtractor={item => item.id}
         renderItem={({item}) => (
           <MappingRow 
             mapping={item} 
             onUpdate={(surahId) => updateMapping(item.id, surahId)}
             onRemove={() => removeMapping(item.id)}
             onEditStart={() => setEditingMappingId(item.id)}
             theme={theme}
           />
         )}
         contentContainerStyle={{paddingBottom: 100}}
       />
       
       <View style={[styles.footer, {backgroundColor: theme.colors.background}]}>
         <Button 
            title={`Save ${mappings.filter(m => m.surahId).length} Files`}
            onPress={handleSave}
            disabled={loading}
         />
       </View>
    </View>
  );

  const renderUploading = () => (
    <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, {color: theme.colors.text}]}>
            Uploading {uploadProgress.current} / {uploadProgress.total}
        </Text>
    </View>
  );

  return (
    <BaseModal
      bottomSheetRef={bottomSheetRef}
      snapPoints={snapPoints}
      title={
        step === 'pick' ? 'Bulk Upload' : 
        step === 'mode' ? 'Assignment Method' :
        step === 'review' ? 'Review Mappings' : 'Uploading...'
      }
    >
      {step === 'pick' && (
        <AnimatedView 
          style={styles.pickContainer}
          entering={FadeIn}
          exiting={FadeOut}
        >
            <Icon name="upload-file" type="material" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.pickText, {color: theme.colors.text}]}>
                Select multiple audio files to upload
            </Text>
            <Button title="Select Files" onPress={handlePickFiles} />
        </AnimatedView>
      )}
      
      {step === 'mode' && (
        <AnimatedView entering={SlideInRight} exiting={SlideOutLeft} style={{flex: 1}}>
           {renderModeSelection()}
        </AnimatedView>
      )}
      
      {step === 'review' && (
        <AnimatedView entering={SlideInRight} exiting={SlideOutLeft} style={{flex: 1}}>
           {renderReview()}
        </AnimatedView>
      )}

      {step === 'uploading' && (
        <AnimatedView entering={FadeIn} exiting={FadeOut} style={{flex: 1}}>
          {renderUploading()}
        </AnimatedView>
      )}

      {editingMappingId && (
        <SurahPicker
            onSelect={(id) => {
                updateMapping(editingMappingId, id);
                setEditingMappingId(null);
            }}
            onClose={() => setEditingMappingId(null)}
            theme={theme}
        />
      )}

    </BaseModal>
  );
};

// Sub-component for Smart Match with AI Gradient
const SmartMatchButton = ({onPress, theme, delay}: any) => {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0.8);

    useEffect(() => {
        scale.value = withRepeat(withSequence(withTiming(1.02, {duration: 2000}), withTiming(1, {duration: 2000})), -1, true);
        opacity.value = withRepeat(withSequence(withTiming(1, {duration: 1500}), withTiming(0.8, {duration: 1500})), -1, true);
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{scale: scale.value}],
        opacity: opacity.value
    }));

    return (
        <AnimatedTouchableOpacity
            entering={FadeIn.delay(delay).springify()}
            onPress={onPress}
            activeOpacity={0.9}
            style={[animatedStyle, {marginBottom: 10}]}
        >
            <LinearGradient
                colors={['#6366f1', '#8b5cf6', '#3b82f6']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={[styles.modeButton, {borderWidth: 0}]}
            >
                <Icon name="auto-awesome" type="material" color="#fff" size={32} />
                <View style={styles.modeTextContainer}>
                    <Text style={[styles.modeTitle, {color: '#fff'}]}>Smart Match</Text>
                    <Text style={[styles.modeDescription, {color: 'rgba(255,255,255,0.9)'}]}>
                        Auto-detect Surah from filenames 
                    </Text>
                </View>
            </LinearGradient>
        </AnimatedTouchableOpacity>
    );
};

// Sub-component for animated button
const AnimatedButton = ({onPress, theme, icon, title, description, delay}: any) => {
    const scale = useSharedValue(1);
    
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{scale: scale.value}],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.95);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    return (
        <AnimatedTouchableOpacity
            entering={FadeIn.delay(delay).springify()}
            style={[styles.modeButton, {backgroundColor: theme.colors.card}, animatedStyle]}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
        >
            <Icon name={icon} type="material" color={theme.colors.primary} size={32} />
            <View style={styles.modeTextContainer}>
                <Text style={[styles.modeTitle, {color: theme.colors.text}]}>{title}</Text>
                <Text style={[styles.modeDescription, {color: theme.colors.textSecondary}]}>
                    {description}
                </Text>
            </View>
        </AnimatedTouchableOpacity>
    );
};

// Sub-component for row
const MappingRow = ({mapping, onUpdate, onRemove, onEditStart, theme}: {
    mapping: FileMapping, 
    onUpdate: (id: number | null) => void,
    onRemove: () => void,
    onEditStart: () => void,
    theme: any
}) => {
    const currentSurah = mapping.surahId ? SURAHS.find(s => s.id === mapping.surahId) : null;

    return (
        <AnimatedView 
            layout={Layout.springify()} 
            entering={FadeIn} 
            style={[styles.row, {borderBottomColor: theme.colors.border}]}
        >
            <TouchableOpacity onPress={onRemove} style={{padding: 5}}>
                 <Icon name="delete-outline" type="material-community" color={theme.colors.error} size={20} />
            </TouchableOpacity>

            <View style={styles.fileInfo}>
                <Text numberOfLines={1} style={[styles.fileName, {color: theme.colors.text}]}>
                    {mapping.file.name}
                </Text>
            </View>
            
            <TouchableOpacity 
                style={[
                    styles.surahSelector, 
                    {backgroundColor: mapping.surahId ? theme.colors.card : theme.colors.backgroundSecondary}
                ]}
                onPress={onEditStart}
            >
                <Text style={{color: mapping.surahId ? theme.colors.primary : theme.colors.textSecondary}}>
                    {currentSurah ? `${currentSurah.id}. ${currentSurah.name}` : 'Select Surah'}
                </Text>
            </TouchableOpacity>
        </AnimatedView>
    );
};

const SurahPicker = ({onSelect, onClose, theme}: {onSelect: (id: number | null) => void, onClose: () => void, theme: any}) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredSurahs = useMemo(() => {
        if (!searchQuery) return SURAHS;
        const lower = searchQuery.toLowerCase();
        return SURAHS.filter(s => 
            s.name.toLowerCase().includes(lower) || 
            s.translated_name_english.toLowerCase().includes(lower) ||
            s.id.toString() === lower
        );
    }, [searchQuery]);

    return (
        <AnimatedView 
            entering={SlideInRight} 
            exiting={SlideOutLeft}
            style={[StyleSheet.absoluteFill, {backgroundColor: theme.colors.background, padding: 20, zIndex: 999}]}
        >
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
                <Text style={[styles.subtitle, {color: theme.colors.text, marginBottom: 0}]}>Select Surah</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                    <Icon name="close" color={theme.colors.text} />
                </TouchableOpacity>
            </View>
            
            <Input
                placeholder="Search surah..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                containerStyle={{marginBottom: 10}}
                showIcon
                iconName="search"
            />

            <FlatList
                data={filteredSurahs}
                keyExtractor={item => item.id.toString()}
                ListHeaderComponent={() => (
                    <AnimatedTouchableOpacity 
                        entering={FadeIn}
                        style={{padding: 15, borderBottomWidth: 1, borderBottomColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', gap: 10}}
                        onPress={() => onSelect(null)}
                    >
                         <Icon name="close-circle-outline" type="material-community" color={theme.colors.textSecondary} size={20} />
                         <Text style={{color: theme.colors.textSecondary}}>None / Unassign</Text>
                    </AnimatedTouchableOpacity>
                )}
                renderItem={({item}) => (
                    <AnimatedTouchableOpacity 
                        entering={FadeIn}
                        layout={Layout.springify()}
                        style={{padding: 15, borderBottomWidth: 1, borderBottomColor: theme.colors.border}}
                        onPress={() => onSelect(item.id)}
                    >
                        <Text style={{color: theme.colors.text}}>{item.id}. {item.name} - {item.translated_name_english}</Text>
                    </AnimatedTouchableOpacity>
                )}
            />
        </AnimatedView>
    );
}

const styles = StyleSheet.create({
  pickContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  pickText: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-Medium',
    textAlign: 'center',
    marginBottom: 20,
  },
  modeContainer: {
    gap: 16,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 16,
  },
  modeTextContainer: {
    flex: 1,
  },
  modeTitle: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-Bold',
  },
  modeDescription: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-Regular',
  },
  headerControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-Bold',
    marginBottom: 10,
  },
  statsText: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Medium',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Regular',
  },
  surahSelector: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  loadingText: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-Medium',
  }
});

