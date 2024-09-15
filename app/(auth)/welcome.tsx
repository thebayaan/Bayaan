import React from 'react';
import {View, Text, Image, TouchableOpacity, Platform} from 'react-native';
import {useRouter} from 'expo-router';
import {Button} from '@/components/Button';
import {Icon} from '@rneui/themed';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from '@/app/(auth)/styles';
import {SafeAreaView} from 'react-native-safe-area-context';

const AppleLogo = require('@/assets/images/apple-logo.png');
const GoogleIcon = require('@/assets/images/google-icon.png');

export default function WelcomeScreen() {
  const router = useRouter();
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const handleSocialSignUp = (provider: string) => {
    console.log(`${provider} sign-up clicked`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('@/assets/images/app_icon.png')}
          style={styles.logo}
        />
        <Text style={styles.welcomeText}>Welcome to Bayaan</Text>
        <Text style={styles.subText}>
          Your personal Quran recitation companion
        </Text>

        <Button
          title="Sign up with Email"
          onPress={() => router.push('/signup')}
          style={styles.button}
          icon={
            <Icon
              name="user-circle"
              type="font-awesome-5"
              color={'white'}
              containerStyle={styles.buttonIcon}
            />
          }
        />

        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => handleSocialSignUp('Apple')}>
            <View style={styles.socialButtonContent}>
              <Image source={AppleLogo} style={styles.appleIcon} />
              <Text style={styles.socialButtonText}>Continue with Apple</Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.socialButton}
          onPress={() => handleSocialSignUp('Google')}>
          <View style={styles.socialButtonContent}>
            <Image source={GoogleIcon} style={styles.googleIcon} />
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </View>
        </TouchableOpacity>

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
