import React, {useEffect, useState} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Icon} from '@rneui/themed';
import {ReciterImage} from '@/components/ReciterImage';
import {getSurahById, getReciterById} from '@/services/dataService';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {Reciter, Rewayat} from '@/data/reciterData';
import Color from 'color';

interface TrackItemProps {
  reciterId: string;
  surahId: string;
  rewayatId?: string;
  onPress: () => void;
  onPlayPress?: () => void;
}

export const TrackItem: React.FC<TrackItemProps> = React.memo(
  ({reciterId, surahId, rewayatId, onPress, onPlayPress}) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);
    const [reciter, setReciter] = useState<Reciter | null>(null);
    const [rewayat, setRewayat] = useState<Rewayat | null>(null);

    useEffect(() => {
      let mounted = true;
      const loadReciter = async () => {
        try {
          const data = await getReciterById(reciterId);
          if (mounted && data) {
            setReciter(data);
            // Find the rewayat if rewayatId is provided
            if (rewayatId && data.rewayat) {
              const foundRewayat = data.rewayat.find(r => r.id === rewayatId);
              if (foundRewayat) {
                setRewayat(foundRewayat);
              }
            }
          }
        } catch (error) {
          console.error('Error loading reciter:', error);
        }
      };
      loadReciter();
      return () => {
        mounted = false;
      };
    }, [reciterId, rewayatId]);

    const surah = getSurahById(parseInt(surahId, 10));
    if (!surah || !reciter) return null;

    const surahGlyph = surahGlyphMap[surah.id];

    // Create a compact badge for the rewayat if available
    const renderRewayatBadge = () => {
      if (!rewayat) return null;
      return (
        <Text style={styles.rewayatText}>
          {rewayat.name}
          {rewayat.style ? ` • ${rewayat.style}` : ''}
        </Text>
      );
    };

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
              {renderRewayatBadge()}
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
      fontSize: moderateScale(14),
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
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginVertical: moderateScale(2),
    },
    rewayatBadge: {
      marginTop: moderateScale(4),
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(6),
      paddingVertical: moderateScale(2),
      borderRadius: moderateScale(4),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
      alignSelf: 'flex-start',
    },
    rewayatText: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textTransform: 'capitalize',
    },
  });
