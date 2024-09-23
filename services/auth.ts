// services/auth.ts
import {supabase} from './supabase';
import {sendVerificationEmail} from './emailService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000; // 1 second

const IS_DEV_MODE = Constants.expoConfig?.extra?.isDevelopmentMode || false;
const ALLOWED_DOMAINS = [
  'bayaanquran.com',
  'gmail.com',
  'outlook.com',
  'hotmail.com',
];

function isAllowedEmail(email: string): boolean {
  if (IS_DEV_MODE) {
    const domain = email.split('@')[1];
    return ALLOWED_DOMAINS.includes(domain);
  }
  return true; // In production, allow all emails
}

export async function signUp(email: string, password: string, retryCount = 0) {
  try {
    if (!isAllowedEmail(email)) {
      return {
        success: false,
        error: 'Email domain not allowed for sign-up during development.',
      };
    }

    console.log(
      `Attempt ${retryCount + 1}: Starting sign up process for:`,
      email,
    );
    const {data, error} = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;

    console.log('Supabase sign up successful, generating verification code');
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    console.log('Sending verification email');
    await sendVerificationEmail(email, verificationCode);
    console.log('Verification email sent successfully');

    console.log('Storing verification code in Supabase');
    const {error: insertError} = await supabase
      .from('verification_codes')
      .insert({email, code: verificationCode});
    if (insertError) throw insertError;
    console.log('Verification code stored successfully');

    return {success: true, data};
  } catch (error) {
    console.error(`Attempt ${retryCount + 1} failed:`, error);
    if (error instanceof Error) {
      if (
        (error.message.includes('timeout') || error.message.includes('504')) &&
        retryCount < MAX_RETRIES
      ) {
        const backoffTime = INITIAL_BACKOFF * Math.pow(2, retryCount);
        console.log(`Retrying in ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return signUp(email, password, retryCount + 1);
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
