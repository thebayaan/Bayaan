import React, {useState} from 'react';
import {View, Text, TouchableOpacity, ScrollView, Platform} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import BottomSheet from '@gorhom/bottom-sheet';
import {BaseModal} from './BaseModal';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {RewayatIcon} from '@/components/Icons';
import ReadMore from '@fawazahmed/react-native-read-more';

interface RewayatStyle {
  id: string;
  name: string;
  style: string;
  isSelected?: boolean;
  onSelect?: () => void;
}

interface RewayatInfoModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  availableRewayat: RewayatStyle[];
  onRewayatSelect?: (rewayatId: string) => void;
  selectedRewayatId?: string;
  onClose?: () => void;
}

export const RewayatInfoModal: React.FC<RewayatInfoModalProps> = ({
  bottomSheetRef,
  availableRewayat,
  onRewayatSelect,
  selectedRewayatId,
  onClose,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const [, setIsExpanded] = useState(false);

  const handleRewayatSelect = (rewayatId: string) => {
    if (onRewayatSelect) {
      onRewayatSelect(rewayatId);
    }
  };

  const explanationText = `A Rewayah (رواية, plural: Rewayat رِوَايَات) is a specific method of reciting the Quran that represents a particular transmission route within a larger Qira'at (قِرَاءَة, plural: Qira'at قِرَاءَات) tradition.

While Qira'at are the major schools of Quranic recitation attributed to famous reciters, Rewayat are the specific ways these recitations were transmitted through chains of narrators back to the Prophet Muhammad ﷺ.

"The Quran was revealed in seven ahruf (styles). So recite what is easier for you from it."
- Sahih al-Bukhari 2419, Sahih Muslim 818

The most widely used Rewayah today is Hafs 'an Assem (حَفْص عَن عَاصِم), which is considered the standard version used in most printed Qurans and is instantly recognizable to most Muslims worldwide.

Each Rewayah may have slight variations in pronunciation, elongation, or articulation points. These differences are purely phonetic and never alter the meaning of the Quranic text, as they all represent authentic ways of reciting the Quran that have been meticulously preserved.`;

  return (
    <BaseModal
      bottomSheetRef={bottomSheetRef}
      snapPoints={['90%']}
      title="About Rewayat"
      index={0}
      onChange={index => {
        if (index === -1) {
          setIsExpanded(false);
          onClose?.();
        }
      }}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={true}
        nestedScrollEnabled={Platform.OS === 'android'}
        disableScrollViewPanResponder={Platform.OS === 'android'}
        scrollEventThrottle={16}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <RewayatIcon color={theme.colors.text} size={moderateScale(60)} />
          </View>

          <ReadMore
            numberOfLines={3}
            style={[styles.description, {color: theme.colors.text}]}
            seeMoreText="read more"
            seeLessText="show less"
            seeMoreStyle={[styles.readMoreText, {color: theme.colors.text}]}
            seeLessStyle={[styles.readMoreText, {color: theme.colors.text}]}
            onCollapse={() => setIsExpanded(false)}
            onExpand={() => setIsExpanded(true)}>
            {explanationText}
          </ReadMore>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Available Rewayat</Text>
          <View style={styles.rewayatList}>
            {availableRewayat.map(rewayat => (
              <TouchableOpacity
                key={rewayat.id}
                style={[
                  styles.rewayatItem,
                  selectedRewayatId === rewayat.id && styles.selectedRewayat,
                ]}
                onPress={() => handleRewayatSelect(rewayat.id)}
                activeOpacity={0.7}>
                <View>
                  <Text style={styles.rewayatName}>{rewayat.name}</Text>
                  <Text style={styles.rewayatStyle}>{rewayat.style}</Text>
                </View>
                {selectedRewayatId === rewayat.id && (
                  <View style={styles.selectedIndicator} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </BaseModal>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    scrollView: {
      flex: 1,
    },
    content: {
      paddingBottom: moderateScale(20),
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: moderateScale(20),
    },
    description: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-Regular',
      lineHeight: moderateScale(24),
    },
    readMoreText: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Bold',
      marginTop: moderateScale(8),
    },
    divider: {
      height: 1,
      backgroundColor: Color(theme.colors.border).alpha(0.1).toString(),
      marginVertical: moderateScale(10),
    },
    sectionTitle: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      marginBottom: moderateScale(16),
    },
    rewayatList: {
      gap: moderateScale(12),
    },
    rewayatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: moderateScale(16),
      backgroundColor: theme.colors.card,
      borderRadius: moderateScale(12),
    },
    selectedRewayat: {
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
      borderColor: theme.colors.text,
    },
    rewayatName: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      marginBottom: moderateScale(4),
    },
    rewayatStyle: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textTransform: 'capitalize',
    },
    selectedIndicator: {
      width: moderateScale(8),
      height: moderateScale(8),
      borderRadius: moderateScale(4),
      backgroundColor: theme.colors.text,
    },
  });
