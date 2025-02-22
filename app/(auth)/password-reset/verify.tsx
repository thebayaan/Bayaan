import React, {useState, useRef} from 'react';
import {View, Text, TouchableOpacity, TextInput, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter, useLocalSearchParams} from 'expo-router';
import {Button} from '@/components/Button';
import {Input} from '@/components/Input';
import {BackButton} from '@/components/BackButton';
import {createStyles} from '../_styles';
import {isValidPassword} from '@/utils/validation';
import {useTheme} from '@/hooks/useTheme';
import {verifyPasswordReset, resetPasswordWithOtp} from '@/services/auth';

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

export default function VerifyResetScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const params = useLocalSearchParams();
  const email = (params.email as string) || '';
  const [verificationCode, setVerificationCode] = useState([
    '',
    '',
    '',
    '',
    '',
    '',
  ]);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const router = useRouter();
  const inputRefs = useRef<Array<TextInput | null>>([]);

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

  const handleVerifyReset = async () => {
    if (!isValidPassword(newPassword)) {
      setError('Password must be at least 8 characters long');
      return;
    }

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
      const {success, error: resetError} = await verifyPasswordReset(
        email,
        code,
        newPassword,
      );
      if (success) {
        Alert.alert('Success', 'Your password has been reset successfully.', [
          {
            text: 'Continue',
            onPress: () => router.replace('/login'),
          },
        ]);
      } else {
        const errorMessage = handleVerificationError(resetError);
        setError(errorMessage);

        if (
          errorMessage.includes('expired') ||
          errorMessage.includes('invalid')
        ) {
          setVerificationCode(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        }
      }
    } catch (err) {
      const errorMessage = handleVerificationError(err);
      setError(errorMessage);
      console.error('Reset verification error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (isResending) return;
    setIsResending(true);

    try {
      setError('');
      const {success, error: resetError} = await resetPasswordWithOtp(email);
      if (success) {
        setVerificationCode(['', '', '', '', '', '']);
        Alert.alert('Code Sent', 'Please check your email for the new code.', [
          {
            text: 'OK',
            onPress: () => inputRefs.current[0]?.focus(),
          },
        ]);
      } else {
        const errorMessage = handleVerificationError(resetError);
        setError(errorMessage);
      }
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
      <BackButton onPress={() => router.back()} />
      <View style={styles.content}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter the code sent to {email} and your new password.
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

        <Input
          placeholder="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry={!showPassword}
          rightIcon={showPassword ? 'eye' : 'eyeo'}
          onRightIconPress={() => setShowPassword(!showPassword)}
          style={styles.inputOverride}
          autoCapitalize="none"
          sanitize={false}
          autoCorrect={false}
          onSubmitEditing={handleVerifyReset}
          returnKeyType="done"
          autoComplete="password"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          title="Reset Password"
          onPress={handleVerifyReset}
          style={styles.button}
          textStyle={styles.buttonText}
          loading={isLoading}
          disabled={
            isLoading ||
            verificationCode.some(digit => digit === '') ||
            !newPassword
          }
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
              : "I DIDN'T RECEIVE A CODE — RESEND RESET CODE"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
