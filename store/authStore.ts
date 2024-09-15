import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Session} from '@supabase/supabase-js';
import {signIn, signOut} from '@/services/auth';
import {supabase} from '@/services/supabase';

interface AuthState {
  session: Session | null;
  isLoading: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{success: boolean; error?: string}>;
  signOut: () => Promise<{success: boolean; error?: string}>;
  setSession: (session: Session | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      isLoading: true,
      signIn: async (email: string, password: string) => {
        const result = await signIn(email, password);
        if (result.success && result.data) {
          set({session: result.data});
        }
        return result;
      },
      signOut: async () => {
        const result = await signOut();
        if (result.success) {
          set({session: null});
        }
        return result;
      },
      setSession: (session: Session | null) => set({session}),
      setIsLoading: (isLoading: boolean) => set({isLoading}),
      initializeAuth: async () => {
        try {
          const {
            data: {session},
          } = await supabase.auth.getSession();
          get().setSession(session);
        } catch (error) {
          console.error('Error initializing auth:', error);
        } finally {
          get().setIsLoading(false);
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => state => {
        // This function runs after the state has been rehydrated from storage
        state?.initializeAuth();
      },
    },
  ),
);

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.getState().setSession(session);
});
