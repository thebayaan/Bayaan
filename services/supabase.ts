// src/services/supabase.ts

import {createClient} from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * NOTE: This file is temporarily modified to work without authentication.
 * The original implementation is preserved for future reference.
 * When re-implementing auth, restore the original error throwing behavior.
 */

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

// Create a mock client when credentials are missing
const mockClient = {
  auth: {
    getSession: () => Promise.resolve(null),
    // Mock user retrieval for development/offline mode
    getUser: () => Promise.resolve(null),
    signOut: () => Promise.resolve(),
    onAuthStateChange: () => {
      return {data: null, error: null};
    },
  },
  from: () => ({
    select: () => Promise.resolve({data: [], error: null}),
    insert: () => Promise.resolve({data: null, error: null}),
    update: () => Promise.resolve({data: null, error: null}),
    delete: () => Promise.resolve({data: null, error: null}),
  }),
};

// Export mock client when credentials are missing
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : mockClient;

export {AsyncStorage};
