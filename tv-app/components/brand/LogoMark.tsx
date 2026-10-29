import React from 'react';
import Svg, {Path} from 'react-native-svg';
import {colors} from '../../theme/colors';

type Props = {size: number; color?: string};

// The Bayaan starburst, same path as `LogoIcon` in `components/Icons.tsx`,
// but taking any color so it can sit in the TV's cream or sky.
const STARBURST =
  'M436.69 266.09L308.26 266.09L427.06 217.31L418.32 196.03L297.58 245.61L389.13 152.58L372.75 136.46L284.03 226.61L333.27 110.1L312.1 101.15L261.5 220.87L261.5 220.87L261.5 90.9L238.5 90.9L238.5 219.33L189.72 100.53L168.44 109.26L218.02 230.01L124.99 138.45L108.87 154.84L199.02 243.56L82.51 194.32L73.56 215.49L193.28 266.09L193.28 266.09L63.31 266.09L63.31 289.09L222.57 289.09L202.42 309.57L150.2 363.9L166.58 380.02L215.97 328.57L215.98 328.56L238.5 305.66L238.5 334.31L238.5 334.31L238.5 409.1L261.5 409.1L261.5 305.02L281.98 325.17L336.31 377.39L352.43 361.01L300.98 311.62L300.97 311.61L278.07 289.09L306.72 289.09L306.72 289.09L436.69 289.09L436.69 266.09';

export function LogoMark({
  size,
  color = colors.text,
}: Props): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 500 500" fill="none">
      <Path d={STARBURST} fill={color} />
    </Svg>
  );
}
