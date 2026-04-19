jest.mock('react-native-mmkv', () => {
  const data = new Map<string, string>();
  const instance = {
    getString: (k: string) => data.get(k),
    set: (k: string, v: string) => data.set(k, v),
    remove: (k: string) => data.delete(k),
    clearAll: () => data.clear(),
  };
  return {
    createMMKV: jest.fn().mockReturnValue(instance),
  };
});
