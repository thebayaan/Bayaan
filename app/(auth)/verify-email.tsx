import React, {useState, useEffect, useRef} from 'react';
import {View, Text, TouchableOpacity, TextInput} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter, useLocalSearchParams} from 'expo-router';
import {supabase} from '@/services/supabase';
import {Button} from '@/components/Button';
import {BackButton} from '@/components/BackButton';
import {useTheme} from '@/hooks/useTheme';
import {sendVerificationEmail} from '@/services/emailService';
import {createStyles} from './styles';

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
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const params = useLocalSearchParams();
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (params.email) {
      setEmail(params.email as string);
    }
  }, [params]);

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
    const code = verificationCode.join('');
    try {
      const {data, error: verificationError} = await supabase
        .from('verification_codes')
        .select()
        .eq('email', email)
        .eq('code', code)
        .single();

      if (verificationError) throw verificationError;

      if (data) {
        const {error: confirmError} = await supabase.auth.updateUser({
          data: {email_confirmed: true},
        });
        if (confirmError) throw confirmError;

        await supabase.from('verification_codes').delete().eq('email', email);

        router.replace('/(tabs)');
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (err) {
      setError('An error occurred during verification');
      console.error(err);
    }
  };

  const handleResendCode = async () => {
    try {
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      await sendVerificationEmail(email, newCode);
      await supabase
        .from('verification_codes')
        .upsert({email, code: newCode}, {onConflict: 'email'});

      setError('');
      setVerificationCode(['', '', '', '', '', '']);
      setError('A new verification code has been sent to your email.');
    } catch (err) {
      setError('An error occurred while resending the code');
      console.error(err);
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
        />

        <TouchableOpacity onPress={handleResendCode}>
          <Text style={styles.resendCode}>
            I DIDN&apos;T RECEIVE A CODE — RESEND VERIFICATION CODE
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
