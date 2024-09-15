import React from 'react';
import {render, act, waitFor} from '@testing-library/react-native';
import {AuthProvider, useAuth} from '../AuthContext';
import {supabase} from '../../../services/supabase';
import {Text, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn(),
      getSession: jest.fn(),
    },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
}));

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('provides initial authentication state', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {session: null},
    });

    const TestComponent = () => {
      const {session, isLoading} = useAuth();
      return (
        <View>
          <Text testID="session">{JSON.stringify(session)}</Text>
          <Text testID="isLoading">{String(isLoading)}</Text>
        </View>
      );
    };

    const {findByTestId} = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    const sessionElement = await findByTestId('session');
    const loadingElement = await findByTestId('isLoading');

    expect(sessionElement.props.children).toBe('null');
    expect(loadingElement.props.children).toBe('false');
  });

  it('updates authentication state on auth state change', async () => {
    const mockSession = {user: {id: '123', email: 'test@example.com'}};
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {session: null},
    });

    let authStateChangeCallback: (event: string, session: unknown) => void;
    (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation(
      callback => {
        authStateChangeCallback = callback;
        return {data: {subscription: {unsubscribe: jest.fn()}}};
      },
    );

    const TestComponent = () => {
      const {session, isLoading} = useAuth();
      return (
        <View>
          <Text testID="session">{JSON.stringify(session)}</Text>
          <Text testID="isLoading">{String(isLoading)}</Text>
        </View>
      );
    };

    const {findByTestId} = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    // Wait for initial state to be set
    await findByTestId('session');

    // Simulate auth state change
    await act(async () => {
      authStateChangeCallback('SIGNED_IN', mockSession);
    });

    // Wait for state to update
    await waitFor(async () => {
      const sessionElement = await findByTestId('session');
      expect(JSON.parse(sessionElement.props.children)).toEqual(mockSession);
    });

    const loadingElement = await findByTestId('isLoading');
    expect(loadingElement.props.children).toBe('false');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'session',
      JSON.stringify(mockSession),
    );
  });

  it('sets isLoading to false after getting initial session', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {session: null},
    });

    const TestComponent = () => {
      const {isLoading} = useAuth();
      return <Text testID="isLoading">{String(isLoading)}</Text>;
    };

    const {findByTestId} = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    const loadingElement = await findByTestId('isLoading');

    await waitFor(() => {
      expect(loadingElement.props.children).toBe('false');
    });
  });

  it('throws error when useAuth is used outside of AuthProvider', () => {
    const TestComponent = () => {
      useAuth();
      return null;
    };

    let error: unknown;
    try {
      render(<TestComponent />);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error instanceof Error).toBe(true);
    if (error instanceof Error) {
      expect(error.message).toBe('useAuth must be used within an AuthProvider');
    } else {
      fail('Expected error to be an instance of Error');
    }
  });
});
