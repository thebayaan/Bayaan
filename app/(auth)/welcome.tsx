/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {View, Text, Image, TouchableOpacity, Platform} from 'react-native';
import {useRouter} from 'expo-router';
import {Button} from '@/components/Button';
import {Icon} from '@rneui/themed';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from '@/app/(auth)/styles';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Alert} from 'react-native';
import {signInWithGoogle, signInWithApple} from '@/services/auth';
import {LogoIcon} from '@/components/Icons';

const AppleLogo = require('@/assets/images/apple-logo.png');
const GoogleIcon = require('@/assets/images/google-icon.png');

export default function WelcomeScreen() {
  const router = useRouter();
  const {theme} = useTheme();
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <LogoIcon
            size={45}
            color={theme.colors.primary}
            isDarkMode={theme.isDarkMode}
          />
          <Text style={styles.appName}>Bayaan</Text>
        </View>
        <Text style={styles.subText}>Connect with the Quran</Text>

        <Button
          title="Sign up with Email"
          onPress={() => router.push('/signup')}
          style={styles.button}
          textColor={theme.colors.background}
          icon={
            <Icon
              name="user-circle"
              type="font-awesome-5"
              color={theme.colors.background}
              containerStyle={styles.buttonIcon}
            />
          }
        />

        <View style={styles.linkContainer}>
          <Text style={styles.linkText}>ALREADY HAVE AN ACCOUNT? </Text>
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={styles.link}>LOG IN</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
