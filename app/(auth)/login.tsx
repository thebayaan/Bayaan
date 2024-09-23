import React, {useState, useEffect} from 'react';
import {View, Text, TouchableOpacity, Platform, Image} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {Button} from '@/components/Button';
import {Input} from '@/components/Input';
import {BackButton} from '@/components/BackButton';
import {createStyles} from './styles';
import {isValidEmail} from '@/utils/validation';
import {useTheme} from '@/hooks/useTheme';
import {useAuthStore} from '@/store/authStore';
const AppleLogo = require('@/assets/images/apple-logo.png');
const GoogleIcon = require('@/assets/images/google-icon.png');

export default function LoginScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const router = useRouter();
  const signIn = useAuthStore(state => state.signIn);

  useEffect(() => {
    setIsFormValid(isValidEmail(email) && password.length >= 8);
  }, [email, password]);

  const handleLogin = async () => {
    try {
      const {success, error: signInError} = await signIn(email, password);
      if (success) {
        router.replace('/(tabs)');
      } else {
        setError(signInError || 'An error occurred during login');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    }
  };

  const handleForgotPassword = () => {
    // Implement forgot password functionality
    console.log('Forgot password clicked');
  };

  const handleSocialSignIn = (provider: string) => {
    // Implement social sign-in functionality
    console.log(`${provider} sign-in clicked`);
  };

  const handleBackButton = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={handleBackButton} />
      <View style={styles.content}>
        <Text style={styles.title}>
          Log in using your existing credentials.
        </Text>

        <Input
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          style={styles.inputOverride}
        />

        <Input
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          rightIcon={showPassword ? 'eye' : 'eyeo'}
          onRightIconPress={() => setShowPassword(!showPassword)}
          style={styles.inputOverride}
          onSubmitEditing={handleLogin}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          returnKeyType="done"
        />
        <View style={styles.forgotPasswordContainer}>
          <Text style={styles.linkText}>FORGOT PASSWORD? — </Text>
          <TouchableOpacity onPress={handleForgotPassword}>
            <Text style={styles.link}>RESET PASSWORD</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          title="Log in"
          onPress={handleLogin}
          style={[styles.button, !isFormValid && styles.buttonDisabled]}
          textStyle={[
            styles.buttonText,
            !isFormValid && styles.buttonTextDisabled,
          ]}
          disabled={!isFormValid}
        />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.socialButton]}
            onPress={() => handleSocialSignIn('Apple')}>
            <View style={styles.socialButtonContent}>
              <Image source={AppleLogo} style={styles.appleIcon} />
              <Text style={styles.socialButtonText}>Continue with Apple</Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.socialButton]}
          onPress={() => handleSocialSignIn('Google')}>
          <View style={styles.socialButtonContent}>
            <Image source={GoogleIcon} style={styles.googleIcon} />
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.linkContainer}>
          <Text style={styles.linkText}>DON&apos;T HAVE AN ACCOUNT? </Text>
          <TouchableOpacity onPress={() => router.push('/signup')}>
            <Text style={styles.link}>CREATE ACCOUNT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
