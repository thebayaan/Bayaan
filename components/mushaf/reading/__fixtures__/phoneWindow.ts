// @ai-generated
/**
 * Gives a test a phone-sized window. Import it before anything that reads
 * the window size when it loads (components/mushaf/constants, utils/scale).
 *
 * Jest's default window is 750 x 1334 points, wider than any phone and wide
 * enough to be an iPad, so a "phone" test run with it does not lay out the
 * way a phone does.
 */
import {Dimensions} from 'react-native';

export const PHONE_WINDOW = {width: 390, height: 844} as const;

const metrics = {...PHONE_WINDOW, scale: 3, fontScale: 1};
Dimensions.set({window: metrics, screen: metrics});
