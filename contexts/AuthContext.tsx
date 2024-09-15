import React, {createContext, useState, useContext, useEffect} from 'react';
import {Session} from '@supabase/supabase-js';
import {signIn, signOut} from '@/services/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from '@/services/supabase';

type AuthContextType = {
  session: Session | null;
  isLoading: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{success: boolean; error?: string}>;
  signOut: () => Promise<{success: boolean; error?: string}>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedSession = await AsyncStorage.getItem('userSession');
        if (storedSession) {
          const parsedSession = JSON.parse(storedSession);
          setSession(parsedSession);
          await supabase.auth.setSession(parsedSession);
        }

        const {data, error} = await supabase.auth.getSession();
        if (error) throw error;
        setSession(data.session);
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    const {data: authListener} = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
      },
    );

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const contextSignIn = async (email: string, password: string) => {
    const result = await signIn(email, password);
    if (result.success && result.data) {
      setSession(result.data);
    }
    return result;
  };

  const contextSignOut = async () => {
    const result = await signOut();
    if (result.success) {
      setSession(null);
    }
    return result;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        signIn: contextSignIn,
        signOut: contextSignOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
