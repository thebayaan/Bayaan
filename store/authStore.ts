// store/authStore.ts

import {create} from 'zustand';
import {Session} from '@supabase/supabase-js';
import {supabase} from '@/services/supabase';

interface AuthState {
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
  isSigningOut: boolean;
  initializeAuth: () => Promise<void>;
  handleAuthStateChange: (session: Session | null) => Promise<void>;
  setSigningOut: (isSigningOut: boolean) => void;
}

export const useAuthStore = create<AuthState>(set => ({
  session: null,
  isLoading: true,
  isInitialized: false,
  isSigningOut: false,

  setSigningOut: (isSigningOut: boolean) => {
    set({isSigningOut});
  },

  handleAuthStateChange: async (session: Session | null) => {
    try {
      set({
        session,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error handling auth state change:', error);
      set({session: null, isLoading: false});
    }
  },

  initializeAuth: async () => {
    try {
      set({isLoading: true});
      const {
        data: {session},
      } = await supabase.auth.getSession();
      await useAuthStore.getState().handleAuthStateChange(session);
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      set({isLoading: false, isInitialized: true});
    }
  },
}));
// Update auth change listener to use new handler
supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.getState().handleAuthStateChange(session);
});
