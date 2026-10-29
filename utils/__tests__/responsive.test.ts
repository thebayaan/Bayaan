// @ai-generated
// Reads the window inside a fresh module registry with a mocked window size.
function isTabletAt(width: number, height: number): boolean {
  let result: boolean | undefined;
  jest.isolateModules(() => {
    const {Dimensions} = require('react-native');
    jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({width, height, scale: 3, fontScale: 1});
    result = require('../responsive').getIsTablet();
  });
  return result as boolean;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getIsTablet', () => {
  it.each([
    [393, 852], // iPhone 15/16
    [440, 956], // iPhone 16/17 Pro Max
    [956, 440], // iPhone 16/17 Pro Max landscape
    [466, 678], // iPhone Duo folded
    [678, 466], // iPhone Duo folded, landscape
  ])('treats %ix%i as a phone', (width, height) => {
    expect(isTabletAt(width, height)).toBe(false);
  });

  it.each([
    [669, 951], // iPhone Duo unfolded, upright (measured)
    [951, 669], // iPhone Duo unfolded, sideways (measured)
    [626, 890], // iPhone Duo unfolded, lower estimate
    [744, 1133], // iPad mini
    [1376, 1032], // iPad Pro 13" landscape
  ])('treats %ix%i as a tablet', (width, height) => {
    expect(isTabletAt(width, height)).toBe(true);
  });
});
