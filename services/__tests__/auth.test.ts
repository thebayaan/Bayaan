import {signUp, signIn, signOut} from '../../../services/auth';
import {supabase} from '../../../services/supabase';

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

describe('Auth Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('signUp', () => {
    it('should sign up a user successfully', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });
      const result = await signUp('test@example.com', 'password');
      expect(result).toEqual({success: true, data: {}});
    });

    it('should handle sign up errors', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error('Sign up failed'),
      });
      const result = await signUp('test@example.com', 'password');
      expect(result).toEqual({success: false, error: 'Sign up failed'});
    });

    it('should handle network errors during sign up', async () => {
      (supabase.auth.signUp as jest.Mock).mockRejectedValue(
        new Error('Network error'),
      );
      const result = await signUp('test@example.com', 'password');
      expect(result).toEqual({success: false, error: 'Network error'});
    });
  });

  describe('signIn', () => {
    it('should sign in a user successfully', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: {session: {}},
        error: null,
      });
      const result = await signIn('test@example.com', 'password');
      expect(result).toEqual({success: true, data: {}});
    });

    it('should handle sign in errors', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: {session: null},
        error: new Error('Sign in failed'),
      });
      const result = await signIn('test@example.com', 'password');
      expect(result).toEqual({success: false, error: 'Sign in failed'});
    });

    it('should handle network errors during sign in', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockRejectedValue(
        new Error('Network error'),
      );
      const result = await signIn('test@example.com', 'password');
      expect(result).toEqual({success: false, error: 'Network error'});
    });
  });

  describe('signOut', () => {
    it('should sign out a user successfully', async () => {
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({error: null});
      const result = await signOut();
      expect(result).toEqual({success: true});
    });

    it('should handle sign out errors', async () => {
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({
        error: new Error('Sign out failed'),
      });
      const result = await signOut();
      expect(result).toEqual({success: false, error: 'Sign out failed'});
    });

    it('should handle network errors during sign out', async () => {
      (supabase.auth.signOut as jest.Mock).mockRejectedValue(
        new Error('Network error'),
      );
      const result = await signOut();
      expect(result).toEqual({success: false, error: 'Network error'});
    });
  });
});
