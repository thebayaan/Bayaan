// services/auth.ts
import {supabase} from './supabase';
import {sendVerificationEmail} from './emailService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function signUp(email: string, password: string) {
  try {
    const {data, error} = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;

    // Generate a verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    // Send verification email
    await sendVerificationEmail(email, verificationCode);

    // Store the verification code in Supabase
    await supabase
      .from('verification_codes')
      .insert({email, code: verificationCode});

    return {success: true, data};
  } catch (error) {
    console.error('Sign up error:', error);
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return {
          success: false,
          error: 'The request timed out. Please try again.',
        };
      }
      if (error.message.includes('network')) {
        return {
          success: false,
          error:
            'A network error occurred. Please check your connection and try again.',
        };
      }
    }
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
    };
  }
}

export async function signIn(email: string, password: string) {
  try {
    const {data, error} = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (data.session) {
      await AsyncStorage.setItem('userSession', JSON.stringify(data.session));
    }
    return {success: true, data: data.session};
  } catch (error) {
    console.error('Sign in error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

export async function signOut() {
  try {
    const {error} = await supabase.auth.signOut();
    if (error) throw error;
    await AsyncStorage.removeItem('userSession');
    return {success: true};
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}
