import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import {Icon} from '@rneui/themed';
import {ReciterImage} from '@/components/ReciterImage';
import {ReciterHeaderProps} from '@/components/reciter-profile/types';
import Color from 'color';

/**
 * ReciterHeader component for the ReciterProfile
 *
 * This component displays the reciter's image, name, and rewayat information
 * in the header section of the ReciterProfile screen.
 *
 * @component
 */
export const ReciterHeader: React.FC<ReciterHeaderProps> = ({
  reciter,
  selectedRewayatId,
  onRewayatInfoPress,
  showSearch,
  insets,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const selectedRewayat =
    reciter.rewayat.find(r => r.id === selectedRewayatId) || reciter.rewayat[0];
  const hasMultipleRewayats = reciter.rewayat.length > 1;

  return (
    <View style={styles.gradientContainer}>
      <View
        style={[
          styles.headerContainer,
          {
            paddingTop: showSearch
              ? moderateScale(15)
              : insets.top + moderateScale(50),
          },
        ]}>
        <ReciterImage
          reciterName={reciter.name}
          imageUrl={reciter.image_url || undefined}
          style={styles.reciterImage}
        />
        <View style={styles.reciterInfo}>
          <Text style={styles.reciterName} numberOfLines={2}>
            {reciter.name}
          </Text>
          {selectedRewayat && (
            <TouchableOpacity
              style={styles.styleButton}
              onPress={onRewayatInfoPress}
              activeOpacity={0.7}>
              <View style={styles.styleTextContainer}>
                <View style={styles.rewayatRow}>
                  <Text style={styles.styleText} numberOfLines={1}>
                    {selectedRewayat.name}
                  </Text>
                  {hasMultipleRewayats ? (
                    <View style={styles.iconContainer}>
                      <Icon
                        name="chevron-down"
                        type="feather"
                        size={moderateScale(14)}
                        color={theme.colors.text}
                      />
                    </View>
                  ) : (
                    <Icon
                      name="info"
                      type="feather"
                      size={moderateScale(14)}
                      color={theme.colors.text}
                      containerStyle={{marginTop: moderateScale(1)}}
                    />
                  )}
                </View>
                <Text style={styles.styleSubText} numberOfLines={1}>
                  {selectedRewayat.style}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    gradientContainer: {
      paddingHorizontal: moderateScale(5),
      paddingBottom: moderateScale(10),
      backgroundColor: theme.colors.background,
    },
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(15),
      gap: moderateScale(15),
      backgroundColor: theme.colors.background,
    },
    reciterImage: {
      width: moderateScale(100),
      height: moderateScale(100),
      borderRadius: moderateScale(12),
      alignSelf: 'flex-start',
    },
    reciterInfo: {
      flex: 1,
      justifyContent: 'center',
      minHeight: moderateScale(100),
      paddingTop: moderateScale(4),
    },
    reciterName: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      lineHeight: moderateScale(18),
    },
    styleButton: {
      paddingVertical: moderateScale(4),
      paddingHorizontal: moderateScale(0),
      backgroundColor: 'transparent',
      marginTop: moderateScale(4),
    },
    styleTextContainer: {
      flex: 1,
    },
    rewayatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(6),
    },
    styleText: {
      color: theme.colors.text,
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      lineHeight: moderateScale(20),
    },
    styleSubText: {
      color: theme.colors.textSecondary,
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Medium',
      marginTop: moderateScale(2),
      textTransform: 'capitalize',
      opacity: 0.8,
    },
    iconContainer: {
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.08).toString(),
      borderRadius: moderateScale(4),
      padding: moderateScale(2),
      marginLeft: moderateScale(2),
    },
  });
