import React, {useState} from 'react';
import {View, Text, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {Button} from '@/components/Button';
import {Input} from '@/components/Input';
import {BackButton} from '@/components/BackButton';
import {createStyles} from '../styles';
import {isValidEmail} from '@/utils/validation';
import {useTheme} from '@/hooks/useTheme';
import {resetPasswordWithOtp} from '@/services/auth';

export default function ForgotPasswordScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleResetPassword = async () => {
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const {success, error: resetError} = await resetPasswordWithOtp(email);
      if (success) {
        Alert.alert(
          'Reset Code Sent',
          'Please check your email for the password reset code.',
        );
        router.push({
          pathname: '/password-reset/verify',
          params: {email},
        });
      } else {
        setError(resetError || 'An error occurred while sending reset code');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => router.back()} />
      <View style={styles.content}>
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>
          Enter your email address and we&apos;ll send you a code to reset your
          password.
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

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          title="Send Reset Code"
          onPress={handleResetPassword}
          style={styles.button}
          textStyle={styles.buttonText}
          disabled={!isValidEmail(email)}
          loading={isLoading}
        />
      </View>
    </SafeAreaView>
  );
}
