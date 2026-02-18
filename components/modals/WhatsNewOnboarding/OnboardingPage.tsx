import React from 'react';
import {View, Text, StyleSheet, Image} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import {OnboardingPage as OnboardingPageType} from '@/data/onboardingPages';
import {QuranIcon, RepeatIcon} from '@/components/Icons';

interface OnboardingPageProps {
  page: OnboardingPageType;
  width: number;
  isIntroPage: boolean;
}

function OnboardingPageComponent({
  page,
  width,
  isIntroPage,
}: OnboardingPageProps) {
  const {theme} = useTheme();

  return (
    <View style={[styles.container, {width}]}>
      {/* Fixed-position header: icon + title stay at the same Y across all pages */}
      <View style={styles.header}>
        {isIntroPage ? (
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.appIcon}
          />
        ) : (
          <LinearGradient
            colors={page.gradientColors ?? ['#6366F1', '#4F46E5']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.iconCircle}>
            {page.isCustomIcon && page.id === 'mushaf' ? (
              <QuranIcon size={moderateScale(64)} color="#FFFFFF" />
            ) : page.isCustomIcon && page.id === 'memorize' ? (
              <RepeatIcon size={moderateScale(64)} color="#FFFFFF" />
            ) : (
              <Ionicons
                name={page.icon as any}
                size={moderateScale(44)}
                color="#FFFFFF"
              />
            )}
          </LinearGradient>
        )}

        <Text style={[styles.title, {color: theme.colors.text}]}>
          {page.title}
        </Text>

        {isIntroPage && page.subtitle && (
          <Text style={[styles.subtitle, {color: theme.colors.textSecondary}]}>
            {page.subtitle}
          </Text>
        )}
      </View>

      {/* Description flows below the fixed header */}
      <Text style={[styles.description, {color: theme.colors.textSecondary}]}>
        {page.description}
      </Text>
    </View>
  );
}

export default React.memo(OnboardingPageComponent);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: moderateScale(24),
  },
  header: {
    alignItems: 'center',
  },
  appIcon: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(20),
    marginBottom: moderateScale(20),
  },
  iconCircle: {
    width: moderateScale(100),
    height: moderateScale(100),
    borderRadius: moderateScale(50),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(20),
  },
  title: {
    fontSize: moderateScale(24),
    fontFamily: 'Manrope-Bold',
    textAlign: 'center',
    marginBottom: moderateScale(8),
  },
  subtitle: {
    fontSize: moderateScale(15),
    fontFamily: 'Manrope-SemiBold',
    textAlign: 'center',
    marginBottom: moderateScale(8),
  },
  description: {
    fontSize: moderateScale(15),
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    lineHeight: moderateScale(22),
    maxWidth: '85%',
    opacity: 0.8,
  },
});
