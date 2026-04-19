jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn().mockImplementation(() => {
    const data = new Map<string, string>();
    return {
      getString: (k: string) => data.get(k) ?? undefined,
      set: (k: string, v: string) => {
        data.set(k, v);
      },
      remove: (k: string) => {
        data.delete(k);
      },
      clearAll: () => {
        data.clear();
      },
    };
  }),
}));
