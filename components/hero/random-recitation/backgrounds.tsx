import React, {useMemo} from 'react';
import {View, StyleSheet} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import Svg, {
  G,
  Rect,
  Circle,
  Ellipse,
  Path,
  Polygon,
  Line,
  Defs,
  Pattern,
  Stop,
  LinearGradient as SvgLinearGradient,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  withSequence,
} from 'react-native-reanimated';
import {Theme} from '@/utils/themeUtils';
import {DesignFamily, FullWidthDesign} from './types';

// ===== SHARED STYLES =====
const abs = StyleSheet.absoluteFillObject;

// ===== D1: ARABESQUE BACKGROUND =====
function ArabesqueBackground({theme}: {theme: Theme}) {
  const shimmerX = useSharedValue(-1);

  React.useEffect(() => {
    shimmerX.value = withRepeat(
      withSequence(
        withTiming(1, {duration: 3000, easing: Easing.inOut(Easing.ease)}),
        withTiming(-1, {duration: 3000, easing: Easing.inOut(Easing.ease)}),
      ),
      -1,
    );
  }, [shimmerX]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{translateX: shimmerX.value * 200}],
  }));

  return (
    <>
      <LinearGradient
        colors={
          theme.isDarkMode
            ? ['#1a0a2e', '#16213e', '#0a3d62']
            : ['#e8e0f0', '#dce4f0', '#d0e8f0']
        }
        start={{x: 0, y: 1}}
        end={{x: 1, y: 0}}
        style={abs}
      />
      {/* Lattice pattern via SVG */}
      <Svg
        style={[abs, {opacity: theme.isDarkMode ? 0.12 : 0.06}]}
        viewBox="0 0 400 80">
        <Defs>
          <Pattern
            id="lattice"
            x="0"
            y="0"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse">
            <G transform="translate(20,20)">
              <Rect
                x={-18}
                y={-18}
                width={36}
                height={36}
                rx={2}
                fill="none"
                stroke={
                  theme.isDarkMode
                    ? 'rgba(255,215,0,0.5)'
                    : 'rgba(90,50,150,0.4)'
                }
                strokeWidth={0.6}
              />
              <Rect
                x={-18}
                y={-18}
                width={36}
                height={36}
                rx={2}
                fill="none"
                stroke={
                  theme.isDarkMode
                    ? 'rgba(255,215,0,0.3)'
                    : 'rgba(90,50,150,0.3)'
                }
                strokeWidth={0.6}
                rotation={45}
                origin="0,0"
              />
              <Circle
                r={5}
                fill="none"
                stroke={
                  theme.isDarkMode
                    ? 'rgba(255,215,0,0.2)'
                    : 'rgba(90,50,150,0.2)'
                }
                strokeWidth={0.4}
              />
            </G>
          </Pattern>
        </Defs>
        <Rect width="400" height="80" fill="url(#lattice)" />
      </Svg>
      {/* Shimmer */}
      <Animated.View style={[abs, shimmerStyle, {opacity: 0.15}]}>
        <LinearGradient
          colors={[
            'transparent',
            theme.isDarkMode ? 'rgba(255,215,0,0.15)' : 'rgba(90,50,150,0.1)',
            'transparent',
          ]}
          start={{x: 0.4, y: 0}}
          end={{x: 0.6, y: 1}}
          style={abs}
        />
      </Animated.View>
    </>
  );
}

// ===== D3: BLOOM BACKGROUND =====
function BloomBackground({theme}: {theme: Theme}) {
  return (
    <>
      <LinearGradient
        colors={
          theme.isDarkMode
            ? ['#1a0a0a', '#2d1515', '#1a0a2e']
            : ['#fdf2f2', '#f5e6f0', '#ede9fe']
        }
        start={{x: 0, y: 1}}
        end={{x: 1, y: 0}}
        style={abs}
      />
      {/* Glow orb */}
      <View
        style={[
          abs,
          {
            justifyContent: 'center',
            alignItems: 'flex-end',
            paddingRight: 30,
          },
        ]}>
        <View
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: theme.isDarkMode
              ? 'rgba(244,63,94,0.12)'
              : 'rgba(190,24,93,0.06)',
          }}
        />
      </View>
    </>
  );
}

// ===== D4: AURORA BACKGROUND =====
function AuroraBackground({theme}: {theme: Theme}) {
  return (
    <>
      <LinearGradient
        colors={
          theme.isDarkMode
            ? ['#0a0a1a', '#0d1117']
            : ['#f0fdf4', '#ecfeff', '#f5f3ff']
        }
        start={{x: 0, y: 1}}
        end={{x: 1, y: 0}}
        style={abs}
      />
      {/* Aurora bands approximated with gradient overlays */}
      <LinearGradient
        colors={
          theme.isDarkMode
            ? [
                'transparent',
                'rgba(52,211,153,0.08)',
                'rgba(56,189,248,0.12)',
                'rgba(139,92,246,0.1)',
                'transparent',
              ]
            : [
                'transparent',
                'rgba(52,211,153,0.06)',
                'rgba(56,189,248,0.08)',
                'rgba(139,92,246,0.06)',
                'transparent',
              ]
        }
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={abs}
      />
      {/* Star dots (dark mode only) */}
      {theme.isDarkMode && (
        <Svg style={[abs, {opacity: 0.4}]} viewBox="0 0 400 80">
          <Circle cx={80} cy={24} r={1} fill="white" opacity={0.3} />
          <Circle cx={240} cy={56} r={1} fill="white" opacity={0.2} />
          <Circle cx={320} cy={16} r={1} fill="white" opacity={0.25} />
          <Circle cx={160} cy={64} r={0.8} fill="white" opacity={0.15} />
          <Circle cx={360} cy={40} r={1} fill="white" opacity={0.2} />
        </Svg>
      )}
    </>
  );
}

// ===== D5: MOSAIC BACKGROUND =====
function MosaicBackground({theme}: {theme: Theme}) {
  const COLORS = [
    '#fbbf24',
    '#ef4444',
    '#8b5cf6',
    '#34d399',
    '#38bdf8',
    '#ec4899',
    '#f97316',
    '#a78bfa',
  ];

  const tiles = useMemo(
    () =>
      Array.from({length: 48}, (_, i) => ({
        color: COLORS[i % COLORS.length],
        opacity: 0.3 + Math.random() * 0.7,
      })),
    [],
  );

  return (
    <>
      <LinearGradient
        colors={
          theme.isDarkMode
            ? ['#0c1a2a', '#142235']
            : ['#fefce8', '#fff7ed', '#fdf2f8']
        }
        start={{x: 0, y: 1}}
        end={{x: 1, y: 0}}
        style={abs}
      />
      <View
        style={[
          abs,
          {
            flexDirection: 'row',
            flexWrap: 'wrap',
            opacity: theme.isDarkMode ? 0.1 : 0.06,
            padding: 2,
            gap: 2,
          },
        ]}>
        {tiles.map((tile, i) => (
          <View
            key={i}
            style={{
              width: '5.8%',
              aspectRatio: 1,
              backgroundColor: tile.color,
              borderRadius: 2,
              opacity: tile.opacity,
            }}
          />
        ))}
      </View>
    </>
  );
}

// ===== D7: MESH BACKGROUND =====
function MeshBackground({theme}: {theme: Theme}) {
  const blobs = [
    {
      color: theme.isDarkMode
        ? 'rgba(139,92,246,0.35)'
        : 'rgba(139,92,246,0.15)',
      left: -10,
      top: -20,
      w: 100,
      h: 80,
    },
    {
      color: theme.isDarkMode
        ? 'rgba(236,72,153,0.3)'
        : 'rgba(236,72,153,0.12)',
      left: undefined,
      right: '30%' as any,
      top: -10,
      w: 90,
      h: 70,
    },
    {
      color: theme.isDarkMode
        ? 'rgba(56,189,248,0.25)'
        : 'rgba(56,189,248,0.12)',
      left: undefined,
      right: -20,
      bottom: -30,
      w: 110,
      h: 90,
    },
    {
      color: theme.isDarkMode ? 'rgba(52,211,153,0.2)' : 'rgba(52,211,153,0.1)',
      left: '40%' as any,
      bottom: -20,
      w: 80,
      h: 60,
    },
  ];

  return (
    <>
      <View
        style={[
          abs,
          {backgroundColor: theme.isDarkMode ? '#0a0a0a' : '#fafafa'},
        ]}
      />
      {blobs.map((blob, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: blob.w,
            height: blob.h,
            borderRadius: 50,
            backgroundColor: blob.color,
            left: blob.left,
            right: (blob as any).right,
            top: blob.top,
            bottom: (blob as any).bottom,
          }}
        />
      ))}
    </>
  );
}

// ===== FULL-WIDTH: ARABESQUE BAND =====
function FWArabesqueBackground({theme}: {theme: Theme}) {
  return (
    <>
      <LinearGradient
        colors={
          theme.isDarkMode
            ? ['#1a0a2e', '#16213e', '#0a3d62']
            : ['#e8e0f0', '#dce4f0', '#d0e8f0']
        }
        start={{x: 0, y: 1}}
        end={{x: 1, y: 0}}
        style={abs}
      />
      <Svg
        style={[abs, {opacity: theme.isDarkMode ? 0.12 : 0.06}]}
        viewBox="0 0 400 85">
        <Defs>
          <Pattern
            id="fw-arab"
            x="0"
            y="0"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse">
            <G transform="translate(30,30)">
              <Rect
                x={-16}
                y={-16}
                width={32}
                height={32}
                rx={2}
                fill="none"
                stroke={
                  theme.isDarkMode
                    ? 'rgba(255,215,0,0.6)'
                    : 'rgba(90,50,150,0.5)'
                }
                strokeWidth={0.6}
              />
              <Rect
                x={-16}
                y={-16}
                width={32}
                height={32}
                rx={2}
                fill="none"
                stroke={
                  theme.isDarkMode
                    ? 'rgba(255,215,0,0.4)'
                    : 'rgba(90,50,150,0.3)'
                }
                strokeWidth={0.6}
                rotation={45}
                origin="0,0"
              />
              <Circle
                r={6}
                fill="none"
                stroke={
                  theme.isDarkMode
                    ? 'rgba(255,215,0,0.3)'
                    : 'rgba(90,50,150,0.25)'
                }
                strokeWidth={0.5}
              />
              <Circle
                r={2}
                fill={
                  theme.isDarkMode
                    ? 'rgba(255,215,0,0.2)'
                    : 'rgba(90,50,150,0.15)'
                }
              />
            </G>
          </Pattern>
        </Defs>
        <Rect width="400" height="85" fill="url(#fw-arab)" />
      </Svg>
    </>
  );
}

// ===== FULL-WIDTH: GRADIENT RIBBON =====
function FWRibbonBackground({theme}: {theme: Theme}) {
  return (
    <>
      <View
        style={[
          abs,
          {backgroundColor: theme.isDarkMode ? '#111118' : '#f0eff5'},
        ]}
      />
      <Svg style={abs} viewBox="0 0 400 85">
        <Defs>
          <SvgLinearGradient
            id="rib1"
            x1="0"
            y1="0"
            x2="400"
            y2="0"
            gradientUnits="userSpaceOnUse">
            <Stop
              offset="0%"
              stopColor="#8b5cf6"
              stopOpacity={theme.isDarkMode ? 0.4 : 0.2}
            />
            <Stop
              offset="25%"
              stopColor="#ec4899"
              stopOpacity={theme.isDarkMode ? 0.35 : 0.15}
            />
            <Stop
              offset="50%"
              stopColor="#38bdf8"
              stopOpacity={theme.isDarkMode ? 0.3 : 0.15}
            />
            <Stop
              offset="75%"
              stopColor="#34d399"
              stopOpacity={theme.isDarkMode ? 0.35 : 0.15}
            />
            <Stop
              offset="100%"
              stopColor="#fbbf24"
              stopOpacity={theme.isDarkMode ? 0.3 : 0.15}
            />
          </SvgLinearGradient>
          <SvgLinearGradient
            id="rib2"
            x1="0"
            y1="0"
            x2="400"
            y2="0"
            gradientUnits="userSpaceOnUse">
            <Stop
              offset="0%"
              stopColor="#34d399"
              stopOpacity={theme.isDarkMode ? 0.2 : 0.1}
            />
            <Stop
              offset="50%"
              stopColor="#8b5cf6"
              stopOpacity={theme.isDarkMode ? 0.25 : 0.12}
            />
            <Stop
              offset="100%"
              stopColor="#ec4899"
              stopOpacity={theme.isDarkMode ? 0.2 : 0.1}
            />
          </SvgLinearGradient>
        </Defs>
        <Path
          d="M0 55 Q50 20, 100 40 T200 35 T300 50 T400 30"
          fill="none"
          stroke="url(#rib1)"
          strokeWidth={3}
          opacity={0.8}
        />
        <Path
          d="M0 65 Q80 30, 150 50 T280 45 T400 60"
          fill="none"
          stroke="url(#rib2)"
          strokeWidth={2}
          opacity={0.6}
        />
        <Path
          d="M0 45 Q60 70, 120 45 T240 55 T360 40 T400 50"
          fill="none"
          stroke="url(#rib1)"
          strokeWidth={1.5}
          opacity={0.3}
        />
      </Svg>
    </>
  );
}

// ===== FULL-WIDTH: WIDE MANDALA =====
function FWMandalaBackground({theme}: {theme: Theme}) {
  return (
    <>
      <LinearGradient
        colors={
          theme.isDarkMode
            ? ['#1a0a0a', '#2d1515', '#1a0a2e']
            : ['#fdf2f2', '#f5e6f0', '#ede9fe']
        }
        start={{x: 0, y: 1}}
        end={{x: 1, y: 0}}
        style={abs}
      />
      {/* Large mandala on the right */}
      <View style={[abs, {justifyContent: 'center', alignItems: 'flex-end'}]}>
        <Svg
          width={200}
          height={200}
          viewBox="0 0 200 200"
          style={{opacity: theme.isDarkMode ? 0.18 : 0.1, marginRight: -40}}>
          <G transform="translate(100,100)">
            {Array.from({length: 12}, (_, i) => (
              <Ellipse
                key={i}
                rx={5}
                ry={60}
                fill="none"
                stroke={
                  i % 2 === 0 ? 'rgba(244,63,94,0.5)' : 'rgba(168,85,247,0.4)'
                }
                strokeWidth={0.6}
                rotation={i * 15}
                origin="0,0"
              />
            ))}
            <Circle
              r={15}
              fill="none"
              stroke="rgba(244,63,94,0.3)"
              strokeWidth={0.8}
            />
            <Circle
              r={30}
              fill="none"
              stroke="rgba(168,85,247,0.2)"
              strokeWidth={0.5}
            />
          </G>
        </Svg>
      </View>
      {/* Left glow */}
      <View
        style={{
          position: 'absolute',
          left: 20,
          top: '50%',
          width: 80,
          height: 80,
          marginTop: -40,
          borderRadius: 40,
          backgroundColor: theme.isDarkMode
            ? 'rgba(244,63,94,0.1)'
            : 'rgba(190,24,93,0.05)',
        }}
      />
    </>
  );
}

// ===== FULL-WIDTH: MOSAIC BAND =====
function FWMosaicBackground({theme}: {theme: Theme}) {
  const COLORS = [
    '#fbbf24',
    '#ef4444',
    '#8b5cf6',
    '#34d399',
    '#38bdf8',
    '#ec4899',
    '#f97316',
    '#a78bfa',
  ];

  const tiles = useMemo(
    () =>
      Array.from({length: 32}, (_, i) => ({
        color: COLORS[i % COLORS.length],
        opacity: 0.3 + Math.random() * 0.7,
      })),
    [],
  );

  return (
    <>
      <LinearGradient
        colors={
          theme.isDarkMode
            ? ['#0c1a2a', '#142235']
            : ['#fefce8', '#fff7ed', '#fdf2f8']
        }
        start={{x: 0, y: 1}}
        end={{x: 1, y: 0}}
        style={abs}
      />
      <View
        style={{
          position: 'absolute',
          top: -5,
          right: -5,
          bottom: -5,
          left: '40%',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 3,
          opacity: theme.isDarkMode ? 0.13 : 0.07,
          transform: [{skewX: '-12deg'}],
        }}>
        {tiles.map((tile, i) => (
          <View
            key={i}
            style={{
              width: '11%',
              aspectRatio: 1,
              backgroundColor: tile.color,
              borderRadius: 2,
              opacity: tile.opacity,
            }}
          />
        ))}
      </View>
    </>
  );
}

// ===== FULL-WIDTH: AURORA WAVE =====
function FWAuroraBackground({theme}: {theme: Theme}) {
  return (
    <>
      <LinearGradient
        colors={
          theme.isDarkMode
            ? ['#0a0a1a', '#0d1117']
            : ['#f0fdf4', '#ecfeff', '#f5f3ff']
        }
        start={{x: 0, y: 1}}
        end={{x: 1, y: 0}}
        style={abs}
      />
      <LinearGradient
        colors={
          theme.isDarkMode
            ? [
                'transparent',
                'rgba(52,211,153,0.08)',
                'rgba(56,189,248,0.12)',
                'rgba(139,92,246,0.1)',
                'transparent',
              ]
            : [
                'transparent',
                'rgba(52,211,153,0.06)',
                'rgba(56,189,248,0.08)',
                'rgba(139,92,246,0.06)',
                'transparent',
              ]
        }
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={abs}
      />
      {/* Hex pattern overlay */}
      <Svg
        style={[abs, {opacity: theme.isDarkMode ? 0.06 : 0.04}]}
        viewBox="0 0 400 85">
        <Defs>
          <Pattern
            id="hex"
            width="30"
            height="26"
            patternUnits="userSpaceOnUse">
            <Polygon
              points="15,0 30,7.5 30,22.5 15,30 0,22.5 0,7.5"
              fill="none"
              stroke="white"
              strokeWidth={0.5}
            />
          </Pattern>
        </Defs>
        <Rect width="400" height="85" fill="url(#hex)" />
      </Svg>
      {/* Stars */}
      {theme.isDarkMode && (
        <Svg style={[abs, {opacity: 0.4}]} viewBox="0 0 400 80">
          <Circle cx={80} cy={24} r={1} fill="white" opacity={0.3} />
          <Circle cx={240} cy={56} r={1} fill="white" opacity={0.2} />
          <Circle cx={320} cy={16} r={1} fill="white" opacity={0.25} />
        </Svg>
      )}
    </>
  );
}

// ===== FULL-WIDTH: WIDE MESH =====
function FWMeshBackground({theme}: {theme: Theme}) {
  const blobs = [
    {
      color: theme.isDarkMode
        ? 'rgba(139,92,246,0.35)'
        : 'rgba(139,92,246,0.15)',
      left: -10,
      top: -20,
      w: 120,
      h: 80,
    },
    {
      color: theme.isDarkMode
        ? 'rgba(236,72,153,0.3)'
        : 'rgba(236,72,153,0.12)',
      left: '25%',
      top: -10,
      w: 100,
      h: 70,
    },
    {
      color: theme.isDarkMode
        ? 'rgba(56,189,248,0.25)'
        : 'rgba(56,189,248,0.12)',
      right: '25%',
      bottom: -20,
      w: 90,
      h: 80,
    },
    {
      color: theme.isDarkMode ? 'rgba(52,211,153,0.2)' : 'rgba(52,211,153,0.1)',
      right: -20,
      bottom: -30,
      w: 110,
      h: 90,
    },
    {
      color: theme.isDarkMode
        ? 'rgba(251,191,36,0.15)'
        : 'rgba(251,191,36,0.08)',
      left: '50%',
      top: '50%',
      w: 80,
      h: 60,
      mt: -30,
      ml: -40,
    },
  ];

  return (
    <>
      <View
        style={[
          abs,
          {backgroundColor: theme.isDarkMode ? '#0a0a0a' : '#fafafa'},
        ]}
      />
      {blobs.map((blob, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: blob.w,
            height: blob.h,
            borderRadius: 50,
            backgroundColor: blob.color,
            left: blob.left as any,
            right: (blob as any).right,
            top: blob.top as any,
            bottom: (blob as any).bottom,
            marginTop: (blob as any).mt,
            marginLeft: (blob as any).ml,
          }}
        />
      ))}
    </>
  );
}

// ===== FULL-WIDTH: CRESCENT GARDEN =====
function FWCrescentBackground({theme}: {theme: Theme}) {
  const crescentFill = theme.isDarkMode
    ? 'rgba(251,191,36,0.4)'
    : 'rgba(180,83,9,0.2)';
  const starFill = theme.isDarkMode
    ? 'rgba(251,191,36,0.3)'
    : 'rgba(180,83,9,0.15)';
  const starSmallFill = theme.isDarkMode
    ? 'rgba(251,191,36,0.25)'
    : 'rgba(180,83,9,0.1)';

  return (
    <>
      <LinearGradient
        colors={
          theme.isDarkMode
            ? ['#0f0f23', '#1a1a3e', '#0d0d2b']
            : ['#fffbeb', '#fef3c7', '#fff7ed']
        }
        start={{x: 0, y: 1}}
        end={{x: 1, y: 0}}
        style={abs}
      />
      <Svg
        style={[abs, {opacity: theme.isDarkMode ? 0.18 : 0.12}]}
        viewBox="0 0 400 85">
        <Defs>
          <Pattern
            id="crescent-pat"
            width="70"
            height="70"
            patternUnits="userSpaceOnUse">
            <Path
              d="M35 10C22 10 12 22 12 35C12 48 22 60 35 60C28 56 23 46 23 35C23 24 28 14 35 10Z"
              fill={crescentFill}
              scale={0.5}
              x={17.5}
              y={17.5}
            />
            <Path
              d="M50 10L51.5 15L56 16L51.5 17L50 22L48.5 17L44 16L48.5 15Z"
              fill={starFill}
            />
            <Path
              d="M15 50L16 53L19 54L16 55L15 58L14 55L11 54L14 53Z"
              fill={starSmallFill}
            />
          </Pattern>
        </Defs>
        <Rect width="400" height="85" fill="url(#crescent-pat)" />
      </Svg>
      {/* Twinkling stars */}
      {theme.isDarkMode && (
        <Svg style={[abs, {opacity: 0.5}]} viewBox="0 0 400 80">
          <Circle cx={60} cy={20} r={1.2} fill="rgba(251,191,36,0.3)" />
          <Circle cx={180} cy={48} r={1} fill="rgba(251,191,36,0.2)" />
          <Circle cx={300} cy={24} r={1} fill="rgba(251,191,36,0.25)" />
          <Circle cx={360} cy={56} r={1.2} fill="rgba(251,191,36,0.3)" />
        </Svg>
      )}
    </>
  );
}

// ===== LOOKUP MAPS =====

const BACKGROUND_MAP: Record<DesignFamily, React.FC<{theme: Theme}>> = {
  arabesque: ArabesqueBackground,
  bloom: BloomBackground,
  aurora: AuroraBackground,
  mosaic: MosaicBackground,
  mesh: MeshBackground,
};

const FULLWIDTH_MAP: Record<FullWidthDesign, React.FC<{theme: Theme}>> = {
  'fw-arabesque': FWArabesqueBackground,
  'fw-ribbon': FWRibbonBackground,
  'fw-mandala': FWMandalaBackground,
  'fw-mosaic': FWMosaicBackground,
  'fw-aurora': FWAuroraBackground,
  'fw-mesh': FWMeshBackground,
  'fw-crescent': FWCrescentBackground,
};

export function renderBackground(design: DesignFamily, theme: Theme) {
  const Component = BACKGROUND_MAP[design];
  return Component ? <Component theme={theme} /> : null;
}

export function renderFullWidthBackground(
  design: FullWidthDesign,
  theme: Theme,
) {
  const Component = FULLWIDTH_MAP[design];
  return Component ? <Component theme={theme} /> : null;
}

// Text color config per design
export function getTextColors(
  design: DesignFamily | FullWidthDesign,
  theme: Theme,
): {labelColor: string; subtitleColor: string; isGradientLabel?: boolean} {
  switch (design) {
    case 'arabesque':
    case 'fw-arabesque':
      return {
        labelColor: theme.isDarkMode
          ? 'rgba(255,215,0,0.7)'
          : 'rgba(90,50,150,0.7)',
        subtitleColor: theme.isDarkMode ? '#fff' : '#1a1a2e',
      };
    case 'bloom':
    case 'fw-mandala':
      return {
        labelColor: theme.isDarkMode
          ? 'rgba(244,63,94,0.8)'
          : 'rgba(190,24,93,0.75)',
        subtitleColor: theme.isDarkMode ? '#fff' : '#1a0a2e',
      };
    case 'aurora':
    case 'fw-aurora':
      return {
        labelColor: '#34d399', // Will be overridden by gradient
        subtitleColor: theme.isDarkMode ? '#fff' : '#0a0a1a',
        isGradientLabel: true,
      };
    case 'mosaic':
    case 'fw-mosaic':
      return {
        labelColor: theme.isDarkMode
          ? 'rgba(251,191,36,0.8)'
          : 'rgba(180,83,9,0.75)',
        subtitleColor: theme.isDarkMode ? '#fff' : '#1a1a2e',
      };
    case 'mesh':
    case 'fw-ribbon':
    case 'fw-mesh':
      return {
        labelColor: theme.isDarkMode
          ? 'rgba(255,255,255,0.5)'
          : 'rgba(0,0,0,0.45)',
        subtitleColor: theme.isDarkMode ? '#fff' : '#1a1a2e',
      };
    case 'fw-crescent':
      return {
        labelColor: theme.isDarkMode
          ? 'rgba(251,191,36,0.75)'
          : 'rgba(146,64,14,0.7)',
        subtitleColor: theme.isDarkMode ? 'rgba(255,255,255,0.95)' : '#1a1a2e',
      };
    default:
      return {
        labelColor: theme.isDarkMode
          ? 'rgba(255,255,255,0.6)'
          : 'rgba(0,0,0,0.5)',
        subtitleColor: theme.isDarkMode ? '#fff' : '#1a1a2e',
      };
  }
}
