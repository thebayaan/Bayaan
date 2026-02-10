import React, {useEffect, useState} from 'react';
import {View, Text, Pressable} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Reciter} from '@/data/reciterData';
import {ReciterImage} from '@/components/ReciterImage';
import {getReciterById} from '@/services/dataService';
import {Feather} from '@expo/vector-icons';

interface ReciterDownloadsListItemProps {
  reciterId: string;
  downloadCount: number;
  onPress: () => void;
  onOptionsPress?: () => void;
  onLongPress?: () => void;
}

export const ReciterDownloadsListItem: React.FC<ReciterDownloadsListItemProps> =
  React.memo(
    ({reciterId, downloadCount, onPress, onOptionsPress, onLongPress}) => {
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

      if (!reciter) return null;

      return (
        <Pressable
          style={styles.container}
          onPress={onPress}
          onLongPress={onLongPress}>
          {/* Rectangular image for downloaded reciters */}
          <View style={styles.imageContainer}>
            <ReciterImage
              imageUrl={reciter.image_url || undefined}
              reciterName={reciter.name}
              style={styles.reciterImage}
              profileIconSize={moderateScale(20)}
            />
          </View>
          <View style={styles.reciterInfo}>
            <Text style={styles.reciterName}>{reciter.name}</Text>
            <Text style={styles.reciterSubtitle} numberOfLines={1}>
              Downloaded • {downloadCount}{' '}
              {downloadCount === 1 ? 'surah' : 'surahs'}
            </Text>
          </View>
          {onOptionsPress && (
            <Pressable
              style={styles.optionsZone}
              onPress={onOptionsPress}
              hitSlop={8}>
              <Feather
                name="more-horizontal"
                size={moderateScale(18)}
                color={theme.colors.text}
              />
            </Pressable>
          )}
        </Pressable>
      );
    },
  );

ReciterDownloadsListItem.displayName = 'ReciterDownloadsListItem';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(8),
      paddingHorizontal: moderateScale(18),
    },
    imageContainer: {
      width: moderateScale(50),
      height: moderateScale(50),
      marginRight: moderateScale(12),
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      borderRadius: moderateScale(4), // Rectangular with rounded corners
      borderWidth: moderateScale(1),
      borderColor: 'transparent',
    },
    reciterImage: {
      width: moderateScale(50),
      height: moderateScale(50),
    },
    reciterInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    reciterName: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
      marginBottom: moderateScale(1),
    },
    reciterSubtitle: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
    optionsZone: {
      width: moderateScale(44),
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
    },
  });
