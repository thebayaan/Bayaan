import React, {useState, useEffect} from 'react';
import {View, Text} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';

import {signUp} from '@/services/auth';
import {Button} from '@/components/Button';
import {Input} from '@/components/Input';
import {BackButton} from '@/components/BackButton';
import {createStyles} from './styles';
import {isValidEmail} from '@/utils/validation';
import {useTheme} from '@/hooks/useTheme';

export default function SignUpScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleBackButton = () => {
    router.back();
  };

  useEffect(() => {
    setIsFormValid(
      isValidEmail(email) &&
        password.length >= 8 &&
        password === confirmPassword,
    );
  }, [email, password, confirmPassword]);

  const handleSignUp = async () => {
    try {
      const {success, error: signUpError} = await signUp(email, password);
      if (success) {
        router.push({
          pathname: '/verify-email',
          params: {email},
        });
      } else {
        setError(
          signUpError || 'An error occurred during sign up. Please try again.',
        );
      }
    } catch (err) {
      setError(
        'An unexpected error occurred. Please check your connection and try again.',
      );
      console.error(err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={handleBackButton} />
      <View style={styles.content}>
        <Text style={styles.title}>Create your account</Text>

        <Input
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          autoComplete="email"
          style={styles.inputOverride}
          iconColor={theme.colors.light}
          returnKeyType="done"
        />

        <Input
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          rightIcon={showPassword ? 'eye' : 'eyeo'}
          onRightIconPress={() => setShowPassword(!showPassword)}
          style={styles.inputOverride}
          iconColor={theme.colors.light}
          returnKeyType="done"
        />

        <Input
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirmPassword}
          rightIcon={showConfirmPassword ? 'eye' : 'eyeo'}
          onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
          style={styles.inputOverride}
          iconColor={theme.colors.light}
          returnKeyType="done"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          title="Sign Up"
          onPress={handleSignUp}
          style={[styles.button, !isFormValid && styles.buttonDisabled]}
          textStyle={[
            styles.buttonText,
            !isFormValid && styles.buttonTextDisabled,
          ]}
          disabled={!isFormValid}
        />
      </View>
    </SafeAreaView>
  );
}
