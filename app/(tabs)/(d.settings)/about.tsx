import React, {useMemo} from 'react';
import {View, Text, ScrollView, Image} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {VersionDisplay} from '@/components/VersionDisplay';

interface FeatureProps {
  title: string;
  description: string;
  styles: ReturnType<typeof createStyles>;
}

const Feature = ({title, description, styles}: FeatureProps) => (
  <View style={styles.featureItem}>
    <Text style={styles.featureTitle}>{title}</Text>
    <Text style={styles.featureDescription}>{description}</Text>
  </View>
);

export default function AboutScreen() {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <View>
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/images/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <VersionDisplay style={styles.version} />

          <Text style={styles.tagline}>
            Your Companion for Quranic Recitation
          </Text>

          <View style={styles.section}>
            <Text style={styles.contentHeading}>Alhamdulillah</Text>
            <Text style={styles.bodyText}>
              All praise is due to Allah for blessing us with the opportunity to
              serve His Book and the Ummah. We are deeply grateful for being
              chosen to develop this platform that connects people with the
              beautiful recitation of the Holy Quran.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.contentHeading}>Our Mission</Text>
            <Text style={styles.bodyText}>
              Bayaan is dedicated to making the beautiful recitation of the Holy
              Quran accessible to everyone. We strive to provide a serene and
              intuitive experience for listening to the Quran, featuring the
              world&apos;s most renowned reciters and a few Bayaan Exclusives.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>FEATURES</Text>
            <View style={styles.featureList}>
              <Feature
                title="Offline Downloads"
                description="Download surahs for offline listening anytime, anywhere without internet connection"
                styles={styles}
              />
              <Feature
                title="Custom Playlists"
                description="Create and manage your own personalized playlists of your favorite recitations"
                styles={styles}
              />
              <Feature
                title="Browse by Juz"
                description="Easily navigate through the Quran with Juz-based organization and grouping"
                styles={styles}
              />
              <Feature
                title="Advanced Audio Controls"
                description="Precise playback control with continuous play and adjustable recitation speed"
                styles={styles}
              />
              <Feature
                title="High-Quality Audio"
                description="Crystal clear recitations from the world's best Qaris with optimized streaming"
                styles={styles}
              />
              <Feature
                title="Curated Collections"
                description="Thoughtfully organized surahs for different occasions and themes"
                styles={styles}
              />
              <Feature
                title="Personalization"
                description="Customize themes, accent colors, and audio settings to your liking"
                styles={styles}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>COMING SOON</Text>
            <Text style={styles.bodyText}>
              We&apos;re working hard to bring you even more features to enhance
              your Quranic journey, including:
            </Text>
            <View style={[styles.featureList, {marginTop: moderateScale(12)}]}>
              <Feature
                title="Multiple Translations"
                description="Access Quran translations in various languages to better understand the meanings"
                styles={styles}
              />
              <Feature
                title="Word-by-Word Follow Along"
                description="Real-time word highlighting synchronized with recitations to help you follow and learn"
                styles={styles}
              />
              <Feature
                title="Smart Bookmarking"
                description="Save your favorite verses and track your progress across surahs"
                styles={styles}
              />
              <Feature
                title="Learning Tools"
                description="Interactive features to help you memorize and understand the Quran better"
                styles={styles}
              />
              <Feature
                title="Community Features"
                description="Connect with others, share your journey, and grow together in your Quranic experience"
                styles={styles}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.contentHeading}>Our Commitment</Text>
            <Text style={styles.bodyText}>
              We are committed to continuous improvement and maintaining the
              highest standards of quality. Our team works diligently to ensure
              that Bayaan remains a reliable and respectful platform for Quranic
              recitation. InshaAllah, with the help of Allah, we will continue
              to develop and enhance these features to better serve the Ummah.
              We are grateful for your support and feedback as we continue this
              blessed journey together.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: moderateScale(24),
      paddingVertical: moderateScale(20),
      paddingBottom: moderateScale(160),
    },
    logoContainer: {
      alignItems: 'center',
      marginVertical: moderateScale(32),
    },
    logo: {
      width: moderateScale(120),
      height: moderateScale(120),
      borderRadius: moderateScale(15),
    },
    version: {
      textAlign: 'center',
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Regular',
      marginBottom: moderateScale(8),
    },
    tagline: {
      textAlign: 'center',
      fontSize: moderateScale(17),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginBottom: moderateScale(32),
    },
    section: {
      marginBottom: moderateScale(28),
    },
    sectionHeader: {
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: moderateScale(10),
      marginLeft: moderateScale(2),
    },
    contentHeading: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.85).toString(),
      marginBottom: moderateScale(10),
    },
    bodyText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      lineHeight: moderateScale(20),
    },
    featureList: {
      gap: moderateScale(10),
    },
    featureItem: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      padding: moderateScale(14),
      borderRadius: moderateScale(14),
    },
    featureTitle: {
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.85).toString(),
      marginBottom: moderateScale(3),
    },
    featureDescription: {
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      lineHeight: moderateScale(17),
    },
  });
