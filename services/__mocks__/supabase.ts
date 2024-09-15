const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

const mockSupabaseClient = {
  auth: {
    signUp: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
  // Add other Supabase client properties/methods as needed
};

export const supabase = mockSupabaseClient;
export const AsyncStorage = mockAsyncStorage;
