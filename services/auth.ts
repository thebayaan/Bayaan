// services/auth.ts

import {supabase} from './supabase';
import {usePlayerStore} from '@/store/playerStore';

export async function signUp(email: string) {
  try {
    const {error} = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: 'bayaan://verify-email',
        data: {
          email_verified: false,
        },
      },
    });

    if (error) {
      console.error('Sign up error:', error);
      return {success: false, error: error.message};
    }

    return {success: true};
  } catch (error) {
    console.error('Unexpected sign up error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred. Please try again later.',
    };
  }
}

export async function signIn(email: string, password: string) {
  try {
    const {data, error} = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error);
      return {success: false, error: error.message};
    }

    return {success: true, data: data.session};
  } catch (error) {
    console.error('Unexpected sign in error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

export async function signOut() {
  try {
    // Clean up player state before signing out
    await usePlayerStore.getState().cleanup();

    const {error} = await supabase.auth.signOut();

    if (error) {
      console.error('Sign out error:', error);
      return {success: false, error: error.message};
    }

    return {success: true};
  } catch (error) {
    console.error('Unexpected sign out error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

export async function resetPassword(email: string) {
  try {
    const {error} = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'bayaan://reset-password',
    });

    if (error) {
      console.error('Password reset error:', error);
      return {success: false, error: error.message};
    }

    return {success: true};
  } catch (error) {
    console.error('Unexpected password reset error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

export async function updatePassword(newPassword: string) {
  try {
    const {error} = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('Password update error:', error);
      return {success: false, error: error.message};
    }

    return {success: true};
  } catch (error) {
    console.error('Unexpected password update error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

export async function resetPasswordWithOtp(email: string) {
  try {
    const {error} = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: undefined, // Remove redirectTo to prevent magic link
    });

    if (error) {
      console.error('Password reset error:', error);
      return {success: false, error: error.message};
    }

    return {success: true};
  } catch (error) {
    console.error('Unexpected password reset error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

export async function verifyPasswordReset(
  email: string,
  token: string,
  newPassword: string,
) {
  try {
    // First verify the OTP
    const {error: verifyError} = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'recovery',
    });

    if (verifyError) {
      console.error('OTP verification error:', verifyError);
      return {success: false, error: verifyError.message};
    }

    // Then update the password
    const {error: updateError} = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      return {success: false, error: updateError.message};
    }

    return {success: true};
  } catch (error) {
    console.error('Password reset verification error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

export async function signInWithGoogle() {
  try {
    const {data, error} = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'bayaan://auth/callback',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('Google sign in error:', error);
      return {success: false, error: error.message};
    }

    return {success: true, data};
  } catch (error) {
    console.error('Unexpected Google sign in error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

export async function signInWithApple() {
  try {
    const {data, error} = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: 'bayaan://auth/callback',
        queryParams: {
          scope: 'email name',
        },
      },
    });

    if (error) {
      console.error('Apple sign in error:', error);
      return {success: false, error: error.message};
    }

    return {success: true, data};
  } catch (error) {
    console.error('Unexpected Apple sign in error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}
