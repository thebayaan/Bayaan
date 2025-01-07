import React, {useState, useRef} from 'react';
import {View, Text, TouchableOpacity, TextInput, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter, useLocalSearchParams} from 'expo-router';
import {supabase} from '@/services/supabase';
import {Button} from '@/components/Button';
import {BackButton} from '@/components/BackButton';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from './styles';

interface AuthError {
  message: string;
  status?: number;
  name?: string;
  statusCode?: string;
}

const handleVerificationError = (
  error: AuthError | Error | unknown,
): string => {
  if (!error) return 'An unexpected error occurred';

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? (error.message as string)
        : 'An unexpected error occurred';

  // Token/OTP specific errors
  if (errorMessage.includes('Token has expired')) {
    return 'Verification code is invalid or has expired. Please try again or request a new code.';
  }
  if (errorMessage.includes('Token is invalid')) {
    return 'Verification code is invalid or has expired. Please try again or request a new code.';
  }
  if (errorMessage.toLowerCase().includes('invalid otp')) {
    return 'Invalid verification code. Please check and try again.';
  }

  // Rate limiting errors
  if (errorMessage.toLowerCase().includes('too many requests')) {
    return 'Too many attempts. Please wait a moment before trying again.';
  }

  // Session errors
  if (errorMessage.toLowerCase().includes('session expired')) {
    return 'Your session has expired. Please request a new verification code.';
  }

  // Network related errors
  if (errorMessage.toLowerCase().includes('network')) {
    return 'Network error. Please check your internet connection.';
  }

  // Generic error with the actual message if available
  return 'Invalid verification code. Please check and try again.';
};

export default function VerifyEmailScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const [verificationCode, setVerificationCode] = useState([
    '',
    '',
    '',
    '',
    '',
    '',
  ]);
  // const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = (params.email as string) || '';
  const inputRefs = useRef<Array<TextInput | null>>([]);

  // useEffect(() => {
  //   if (params.email) {
  //     setEmail(params.email as string);
  //   }
  // }, [params]);

  const handleBackButton = () => {
    router.back();
  };

  const handleCodeChange = (index: number, value: string) => {
    const newCode = [...verificationCode];

    if (value.length === 1) {
      newCode[index] = value;
      setVerificationCode(newCode);

      if (index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    } else if (value.length === 0) {
      newCode[index] = '';
      setVerificationCode(newCode);

      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && verificationCode[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleTextInput = (index: number, text: string) => {
    if (verificationCode[index] !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus();
      const newCode = [...verificationCode];
      newCode[index + 1] = text;
      setVerificationCode(newCode);
    }
  };

  const handleVerify = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError('');

    const code = verificationCode.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits of the verification code');
      setIsLoading(false);
      return;
    }

    try {
      const {error: verifyError} = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup',
      });

      if (verifyError) throw verifyError;

      Alert.alert('Success', 'Email verified successfully!', [
        {
          text: 'Continue',
          onPress: () => router.replace('/(tabs)'),
        },
      ]);
    } catch (err) {
      const errorMessage = handleVerificationError(err);
      setError(errorMessage);
      console.error('Verification error:', err);

      // Clear the verification code if it's invalid or expired
      if (
        errorMessage.includes('expired') ||
        errorMessage.includes('invalid')
      ) {
        setVerificationCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (isResending) return;
    setIsResending(true);

    try {
      setError(''); // Clear any existing errors
      const {error: resendError} = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (resendError) throw resendError;

      // Clear the verification code fields
      setVerificationCode(['', '', '', '', '', '']);

      // Show success message
      Alert.alert(
        'Code Sent',
        'A new verification code has been sent to your email.',
        [
          {
            text: 'OK',
            onPress: () => inputRefs.current[0]?.focus(), // Focus on first input
          },
        ],
      );
    } catch (err) {
      const errorMessage = handleVerificationError(err);
      setError(errorMessage);
      console.error('Resend code error:', err);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={handleBackButton} />
      <View style={styles.content}>
        <Text style={styles.title}>Verify Email</Text>
        <Text style={styles.subtitle}>
          We have sent a verification code by email to {email}. Please check
          your email and enter it below to verify your email.
        </Text>

        <View style={styles.codeContainer}>
          {verificationCode.map((digit, index) => (
            <TextInput
              key={index}
              ref={ref => (inputRefs.current[index] = ref)}
              style={[styles.codeInput, digit ? styles.codeInputFilled : null]}
              value={digit}
              onChangeText={value => handleCodeChange(index, value)}
              onKeyPress={({nativeEvent}) =>
                handleKeyPress(index, nativeEvent.key)
              }
              onTextInput={({nativeEvent}) =>
                handleTextInput(index, nativeEvent.text)
              }
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectionColor={theme.colors.primary}
            />
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          title="Verify"
          onPress={handleVerify}
          style={styles.button}
          textStyle={styles.buttonText}
          loading={isLoading}
          disabled={isLoading || verificationCode.some(digit => digit === '')}
        />

        <TouchableOpacity
          activeOpacity={0.99}
          onPress={handleResendCode}
          disabled={isResending}
          style={[
            styles.resendCodeContainer,
            isResending && styles.resendCodeDisabled,
          ]}>
          <Text
            style={[
              styles.resendCode,
              isResending && styles.resendCodeTextDisabled,
            ]}>
            {isResending
              ? 'SENDING CODE...'
              : "I DIDN'T RECEIVE A CODE — RESEND VERIFICATION CODE"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
