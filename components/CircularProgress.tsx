import React from 'react';
import {View} from 'react-native';
import Svg, {Circle} from 'react-native-svg';
import {moderateScale} from 'react-native-size-matters';

interface CircularProgressProps {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  color: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = moderateScale(20),
  strokeWidth = moderateScale(2),
  color,
}) => {
  // Add padding to prevent stroke clipping
  const padding = strokeWidth;
  const viewBoxSize = size + padding;
  const center = viewBoxSize / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progressOffset = circumference - progress * circumference;

  return (
    <View style={{width: size, height: size}}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.2}
        />
        {/* Progress circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={progressOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${center}, ${center}`}
        />
      </Svg>
    </View>
  );
};
