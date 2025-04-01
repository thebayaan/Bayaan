import React from 'react';
import {View, Text, ScrollView, Image} from 'react-native';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import Animated, {FadeIn} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Header from '@/components/Header';
import {VersionDisplay} from '@/components/VersionDisplay';
import {getVersionString, getBuildTypeLabel} from '@/utils/appVersion';

interface FeatureProps {
  title: string;
  description: string;
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
}

const Feature = ({title, description, theme, styles}: FeatureProps) => (
  <View style={styles.featureItem}>
    <Text style={[styles.featureTitle, {color: theme.colors.text}]}>
      {title}
    </Text>
    <Text
      style={[styles.featureDescription, {color: theme.colors.textSecondary}]}>
      {description}
    </Text>
  </View>
);

export default function AboutScreen() {
  const {theme} = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Header title="About Bayaan" onBack={() => router.back()} />
      <ScrollView
        style={[styles.content, {paddingTop: insets.top + moderateScale(56)}]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.delay(100)}>
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/images/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <VersionDisplay showBuildType style={styles.version} />

          <Text style={[styles.tagline, {color: theme.colors.text}]}>
            Your Companion for Quranic Recitation
          </Text>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
              Alhamdulillah
            </Text>
            <Text
              style={[styles.sectionText, {color: theme.colors.textSecondary}]}>
              All praise is due to Allah for blessing us with the opportunity to
              serve His Book and the Ummah. We are deeply grateful for being
              chosen to develop this platform that connects people with the
              beautiful recitation of the Holy Quran.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
              Our Mission
            </Text>
            <Text
              style={[styles.sectionText, {color: theme.colors.textSecondary}]}>
              Bayaan is dedicated to making the beautiful recitation of the Holy
              Quran accessible to everyone. We strive to provide a serene and
              intuitive experience for listening to the Quran, featuring the
              world&apos;s most renowned reciters and a few Bayaan Exclusives.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
              Features
            </Text>
            <View style={styles.featureList}>
              <Feature
                title="Advanced Audio Controls"
                description="Precise playback control with continuous play and adjustable recitation speed"
                theme={theme}
                styles={styles}
              />
              <Feature
                title="High-Quality Audio"
                description="Crystal clear recitations from the world's best Qaris with optimized streaming and offline support"
                theme={theme}
                styles={styles}
              />
              <Feature
                title="Curated Collections"
                description="Thoughtfully organized surahs for different occasions and themes"
                theme={theme}
                styles={styles}
              />
              <Feature
                title="Personalization"
                description="Customize themes, reading preferences, and audio settings to your liking"
                theme={theme}
                styles={styles}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
              Coming Soon, InshaAllah
            </Text>
            <Text
              style={[styles.sectionText, {color: theme.colors.textSecondary}]}>
              We&apos;re working hard to bring you even more features to enhance
              your Quranic journey, including:
            </Text>
            <View style={[styles.featureList, {marginTop: moderateScale(12)}]}>
              <Feature
                title="Complete Offline Mode"
                description="Download your favorite recitations for seamless offline access anytime, anywhere"
                theme={theme}
                styles={styles}
              />
              <Feature
                title="Custom Playlists"
                description="Create and share personalized collections of your favorite recitations"
                theme={theme}
                styles={styles}
              />
              <Feature
                title="Multiple Translations"
                description="Access Quran translations in various languages to better understand the meanings"
                theme={theme}
                styles={styles}
              />
              <Feature
                title="Exclusive Content"
                description="Special recitations and collections available only on Bayaan"
                theme={theme}
                styles={styles}
              />
              <Feature
                title="Community Features"
                description="Connect with others, share your journey, and grow together in your Quranic experience"
                theme={theme}
                styles={styles}
              />
              <Feature
                title="Word-by-Word Follow Along"
                description="Real-time word highlighting synchronized with recitations to help you follow and learn"
                theme={theme}
                styles={styles}
              />
              <Feature
                title="Smart Bookmarking"
                description="Save your favorite verses and track your progress across surahs"
                theme={theme}
                styles={styles}
              />
              <Feature
                title="Learning Tools"
                description="Interactive features to help you memorize and understand the Quran better"
                theme={theme}
                styles={styles}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
              Our Commitment
            </Text>
            <Text
              style={[styles.sectionText, {color: theme.colors.textSecondary}]}>
              We are committed to continuous improvement and maintaining the
              highest standards of quality. Our team works diligently to ensure
              that Bayaan remains a reliable and respectful platform for Quranic
              recitation. InshaAllah, with the help of Allah, we will continue
              to develop and enhance these features to better serve the Ummah.
              We are grateful for your support and feedback as we continue this
              blessed journey together.
            </Text>
          </View>
        </Animated.View>
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
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: moderateScale(16),
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
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
      marginBottom: moderateScale(8),
    },
    tagline: {
      textAlign: 'center',
      fontSize: moderateScale(20),
      fontFamily: theme.fonts.semiBold,
      marginBottom: moderateScale(32),
    },
    section: {
      marginBottom: moderateScale(32),
    },
    sectionTitle: {
      fontSize: moderateScale(18),
      fontFamily: theme.fonts.semiBold,
      marginBottom: moderateScale(12),
    },
    sectionText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.regular,
      lineHeight: moderateScale(24),
    },
    featureList: {
      gap: moderateScale(16),
    },
    featureItem: {
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      padding: moderateScale(16),
      borderRadius: moderateScale(12),
    },
    featureTitle: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      marginBottom: moderateScale(4),
    },
    featureDescription: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
      lineHeight: moderateScale(20),
    },
  });
