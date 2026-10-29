// @ai-generated
type ScaleModule = typeof import('../scale');

// Both modules read the window once at import, so each load gets a fresh
// module registry with its own mocked window size.
function loadWithWindow<T>(width: number, height: number, load: () => T): T {
  let mod: T | undefined;
  jest.isolateModules(() => {
    const {Dimensions} = require('react-native');
    jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({width, height, scale: 3, fontScale: 1});
    mod = load();
  });
  return mod as T;
}

function loadScale(width: number, height: number): ScaleModule {
  return loadWithWindow(width, height, () => require('../scale'));
}

// The library being replaced, as the oracle for phone sizes.
function loadSizeMatters(width: number, height: number) {
  return loadWithWindow(width, height, () =>
    require('react-native-size-matters'),
  ) as Record<string, (size: number, factor?: number) => number>;
}

const SIZES = [0, 1, 4, 8, 12, 14, 16, 20, 24, 44, 80, 120];
const PHONES: Array<[number, number]> = [
  [320, 568], // iPhone SE (1st gen)
  [375, 667], // iPhone SE
  [393, 852], // iPhone 15/16
  [430, 932], // iPhone Pro Max
  [440, 956], // iPhone 16/17 Pro Max
  [412, 915], // common Android
  [466, 678], // iPhone Duo folded
];
const TABLETS: Array<[number, number]> = [
  [669, 951], // iPhone Duo unfolded, upright (measured)
  [951, 669], // iPhone Duo unfolded, sideways (measured)
  [744, 1133], // iPad mini portrait
  [1133, 744], // iPad mini landscape
  [834, 1194], // iPad Pro 11"
  [1032, 1376], // iPad Pro 13"
  [1376, 1032], // iPad Pro 13" landscape
];

afterEach(() => {
  jest.restoreAllMocks();
});

describe('utils/scale on phones', () => {
  it.each(PHONES)(
    'matches react-native-size-matters exactly at %ix%i',
    (width, height) => {
      const ours = loadScale(width, height);
      const lib = loadSizeMatters(width, height);
      for (const size of SIZES) {
        expect(ours.scale(size)).toBe(lib.scale(size));
        expect(ours.verticalScale(size)).toBe(lib.verticalScale(size));
        expect(ours.moderateScale(size)).toBe(lib.moderateScale(size));
        expect(ours.moderateScale(size, 0.3)).toBe(
          lib.moderateScale(size, 0.3),
        );
        expect(ours.moderateVerticalScale(size)).toBe(
          lib.moderateVerticalScale(size),
        );
      }
    },
  );
});

describe('utils/scale on tablets', () => {
  it.each(TABLETS)('scales %ix%i like a 430x932 phone', (width, height) => {
    const tablet = loadScale(width, height);
    const largePhone = loadSizeMatters(430, 932);
    for (const size of SIZES) {
      expect(tablet.scale(size)).toBeCloseTo(largePhone.scale(size), 10);
      expect(tablet.verticalScale(size)).toBeCloseTo(
        largePhone.verticalScale(size),
        10,
      );
      expect(tablet.moderateScale(size)).toBeCloseTo(
        largePhone.moderateScale(size),
        10,
      );
    }
  });

  it('gives the same sizes in portrait and landscape', () => {
    const portrait = loadScale(1032, 1376);
    const landscape = loadScale(1376, 1032);
    expect(landscape.moderateScale(16)).toBe(portrait.moderateScale(16));
    expect(landscape.verticalScale(16)).toBe(portrait.verticalScale(16));
  });

  it('keeps body text near 16pt instead of doubling it', () => {
    const tablet = loadScale(1032, 1376);
    const lib = loadSizeMatters(1032, 1376);
    expect(tablet.moderateScale(15)).toBeLessThan(17);
    expect(lib.moderateScale(15)).toBeGreaterThan(29);
  });
});

describe('ScaledSheet', () => {
  it('resolves string units the same way as the library on phones', () => {
    const ours = loadScale(393, 852);
    const lib = loadSizeMatters(393, 852) as unknown as {
      ScaledSheet: ScaleModule['ScaledSheet'];
    };
    const styles = {
      box: {
        padding: '16@s',
        marginTop: '12@vs',
        fontSize: '14@ms',
        lineHeight: '14@ms0.3',
        marginBottom: '8@mvs',
        borderRadius: '10@sr',
        width: '-3.5@s',
        flex: 1,
        color: 'red',
        // Nested values are scaled too, as in the library.
        transform: [{translateY: '4@vs'}],
      },
    } as unknown as Parameters<ScaleModule['ScaledSheet']['create']>[0];
    expect(ours.ScaledSheet.create(styles)).toEqual(
      lib.ScaledSheet.create(styles),
    );
  });

  it('resolves string units at large-phone size on tablets', () => {
    const tablet = loadScale(1032, 1376);
    const {box} = tablet.ScaledSheet.create({
      box: {padding: '16@ms', margin: '10@sr', height: 44},
    });
    expect(box.padding).toBeCloseTo(tablet.moderateScale(16), 10);
    expect(box.margin).toBe(Math.round(tablet.scale(10)));
    expect(box.height).toBe(44);
  });
});
