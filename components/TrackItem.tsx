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
            <View style={styles.surahTextContainer}>
              <Text style={styles.surahName}>
                {surah.id + '. ' + surah.name}
              </Text>
              <Text style={styles.reciterName}>{reciter.name}</Text>
            </View>
            <Text style={styles.surahGlyph}>{surahGlyph}</Text>
          </View>
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
      marginHorizontal: moderateScale(15),
      borderRadius: moderateScale(8),
      marginVertical: moderateScale(4),
    },
    imageContainer: {
      marginRight: moderateScale(12),
    },
    reciterImage: {
      width: moderateScale(50),
      height: moderateScale(50),
      borderRadius: moderateScale(10),
    },
    trackInfo: {
      flex: 1,
    },
    surahNameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    surahTextContainer: {
      flex: 1,
      marginRight: moderateScale(12),
    },
    surahName: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    surahGlyph: {
      fontSize: moderateScale(24),
      fontFamily: 'SurahNames',
      color: theme.colors.text,
      textAlign: 'right',
    },
    reciterName: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
      marginTop: moderateScale(2),
    },
  });
