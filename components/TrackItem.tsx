import React, {useEffect, useState} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Icon} from '@rneui/themed';
import {ReciterImage} from '@/components/ReciterImage';
import {getSurahById, getReciterById} from '@/services/dataService';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {Reciter} from '@/data/reciterData';

interface TrackItemProps {
  reciterId: string;
  surahId: string;
  onPress: () => void;
  onPlayPress?: () => void;
}

export const TrackItem: React.FC<TrackItemProps> = React.memo(
  ({reciterId, surahId, onPress, onPlayPress}) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);
    const [reciter, setReciter] = useState<Reciter | null>(null);

    useEffect(() => {
      let mounted = true;
      const loadReciter = async () => {
        try {
          const data = await getReciterById(reciterId);
          if (mounted && data) {
            setReciter(data);
          }
        } catch (error) {
          console.error('Error loading reciter:', error);
        }
      };
      loadReciter();
      return () => {
        mounted = false;
      };
    }, [reciterId]);

    const surah = getSurahById(parseInt(surahId, 10));
    if (!surah || !reciter) return null;

    const surahGlyph = surahGlyphMap[surah.id];

    return (
      <TouchableOpacity
        activeOpacity={0.99}
        style={styles.trackItem}
        onPress={onPress}>
        <View style={styles.imageContainer}>
          <ReciterImage
            reciterName={reciter?.name || ''}
            imageUrl={reciter?.image_url || undefined}
            style={styles.reciterImage}
          />
        </View>
        <View style={styles.trackInfo}>
          <View style={styles.surahNameContainer}>
            <Text style={styles.surahName}>{surah.id + '. ' + surah.name}</Text>
            <Text style={styles.surahGlyph}>{surahGlyph}</Text>
          </View>
          <Text style={styles.reciterName}>{reciter.name}</Text>
        </View>
        {onPlayPress && (
          <TouchableOpacity onPress={onPlayPress}>
            <Icon
              name="play-circle"
              type="feather"
              size={moderateScale(24)}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  },
);

TrackItem.displayName = 'TrackItem';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    trackItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(10),
    },
    imageContainer: {
      marginRight: moderateScale(10),
    },
    reciterImage: {
      width: moderateScale(50),
      height: moderateScale(50),
    },
    trackInfo: {
      flex: 1,
    },
    surahNameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    surahName: {
      fontSize: moderateScale(16),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginRight: moderateScale(8),
    },
    surahGlyph: {
      fontSize: moderateScale(20),
      fontFamily: 'SurahNames',
      color: theme.colors.text,
    },
    reciterName: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
      marginTop: moderateScale(2),
    },
  });
