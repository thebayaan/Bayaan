import React, {useState, useEffect} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {Button} from '@/components/Button';
import {Input} from '@/components/Input';
import {BackButton} from '@/components/BackButton';
import {createStyles} from './_styles';
import {isValidEmail} from '@/utils/validation';
import {useTheme} from '@/hooks/useTheme';
import {signIn} from '@/services/auth';

export default function LoginScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsFormValid(isValidEmail(email) && password.length >= 8);
  }, [email, password]);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const {success, error: signInError} = await signIn(email, password);
      if (!success) {
        setError(signInError || 'An error occurred during login');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push('/password-reset/forgot-password');
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
          sanitize={false}
          autoCorrect={false}
          autoComplete="password"
          returnKeyType="done"
        />
        <View style={styles.forgotPasswordContainer}>
          <Text style={styles.linkText}>FORGOT PASSWORD? — </Text>
          <TouchableOpacity activeOpacity={0.99} onPress={handleForgotPassword}>
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
          loading={isLoading}
          textColor={theme.colors.background}
        />

        <View style={styles.linkContainer}>
          <Text style={styles.linkText}>DON&apos;T HAVE AN ACCOUNT? </Text>
          <TouchableOpacity
            activeOpacity={0.99}
            onPress={() => router.push('/signup')}>
            <Text style={styles.link}>CREATE ACCOUNT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
