import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {EdgeInsets, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Icon} from '@rneui/themed';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import RenderHtml from 'react-native-render-html';

const ExtendedSurahSummary = () => {
  const {theme} = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const styles = createStyles(theme, insets);
  const {surahNumber, surahName, fullText} = useLocalSearchParams<{
    surahNumber: string;
    surahName: string;
    fullText: string;
  }>();
  const surahGlyph = surahNumber
    ? surahGlyphMap[parseInt(surahNumber, 10)] + surahGlyphMap[0]
    : '';

  return (
    <View style={styles.container}>
      <View style={[styles.header]}>
        <TouchableOpacity
          activeOpacity={0.99}
          style={styles.closeButton}
          onPress={router.back}>
          <Icon
            name="arrow-left"
            type="feather"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </TouchableOpacity>
        <Text style={styles.arabicSurahName}>{surahGlyph}</Text>
      </View>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{
          paddingBottom: insets.bottom + moderateScale(16),
        }}>
        <Text style={styles.title}>{surahName}</Text>
        <Text style={styles.surahNumber}>Surah {surahNumber}</Text>
        <RenderHtml
          contentWidth={width}
          source={{html: fullText || ''}}
          baseStyle={styles.summaryText}
          renderersProps={{
            ol: {
              enableExperimentalRtl: true,
            },
          }}
          systemFonts={['SurahNames']}
          tagsStyles={{
            ol: {
              color: theme.colors.text,
            },
            li: {
              color: theme.colors.text,
            },
          }}
        />
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: Theme, insets: EdgeInsets) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingTop: insets.top,
      borderTopLeftRadius: moderateScale(12),
      borderTopRightRadius: moderateScale(12),
      marginTop: moderateScale(-20),
    },
    content: {
      padding: moderateScale(16),
      paddingBottom: moderateScale(100),
    },
    title: {
      fontSize: moderateScale(24),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: moderateScale(8),
    },
    surahNumber: {
      fontSize: moderateScale(18),
      color: theme.colors.text,
      marginBottom: moderateScale(16),
    },
    summaryText: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
      lineHeight: moderateScale(24),
    },
    closeButton: {
      position: 'absolute',
      top: moderateScale(16),
      left: moderateScale(16),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(16),
      paddingHorizontal: moderateScale(16),
    },
    headerTitle: {
      fontSize: moderateScale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    arabicSurahName: {
      fontFamily: 'SurahNames',
      fontSize: moderateScale(24),
      color: theme.colors.text,
    },
  });

export default ExtendedSurahSummary;
