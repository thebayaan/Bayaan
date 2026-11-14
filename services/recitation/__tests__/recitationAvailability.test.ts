function availableOn(os: 'ios' | 'android'): boolean {
  let available = false;
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({Platform: {OS: os}}));
    available = (
      require('../recitationAvailability') as {RECITATION_AVAILABLE: boolean}
    ).RECITATION_AVAILABLE;
  });
  jest.dontMock('react-native');
  return available;
}

describe('RECITATION_AVAILABLE', () => {
  it('is on for iOS', () => {
    expect(availableOn('ios')).toBe(true);
  });

  it('is off for Android until a device pass', () => {
    expect(availableOn('android')).toBe(false);
  });
});
