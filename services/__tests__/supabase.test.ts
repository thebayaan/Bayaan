import {SUPABASE_URL, SUPABASE_ANON_KEY} from '@env';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

// Mock the entire supabase module
jest.mock('../supabase');

// Import after mocking
import {supabase, AsyncStorage} from '../../../services/supabase';

describe('Supabase Service', () => {
  it('should export a Supabase client', () => {
    expect(supabase).toBeDefined();
    expect(supabase).toHaveProperty('auth');
    expect(supabase.auth).toHaveProperty('signUp');
    expect(supabase.auth).toHaveProperty('signIn');
    expect(supabase.auth).toHaveProperty('signOut');
  });

  it('should use correct Supabase configuration', () => {
    expect(SUPABASE_URL).toBe('https://tncrklrswaounqmirayh.supabase.co');
    expect(SUPABASE_ANON_KEY).toBeDefined();
    expect(SUPABASE_ANON_KEY).toMatch(/^eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/);
  });

  it('should mock AsyncStorage', () => {
    expect(AsyncStorage).toBeDefined();
    expect(AsyncStorage).toHaveProperty('getItem');
    expect(AsyncStorage).toHaveProperty('setItem');
    expect(AsyncStorage).toHaveProperty('removeItem');
  });
});
