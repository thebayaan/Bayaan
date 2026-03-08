import React from 'react';
import Svg, {
  G,
  Rect,
  Circle,
  Ellipse,
  Path,
  Line,
  Polygon,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import {moderateScale} from 'react-native-size-matters';

const S = moderateScale(26);

// ===== D1 ARABESQUE ICONS =====

export function OrnateStarIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 28 28">
      <G transform="translate(14,14)">
        <Rect
          x={-8}
          y={-8}
          width={16}
          height={16}
          rx={1.5}
          fill="none"
          stroke="rgba(255,215,0,0.8)"
          strokeWidth={1.2}
          rotation={0}
          origin="0,0"
        />
        <Rect
          x={-8}
          y={-8}
          width={16}
          height={16}
          rx={1.5}
          fill="none"
          stroke="rgba(255,215,0,0.6)"
          strokeWidth={1.2}
          rotation={45}
          origin="0,0"
        />
        <Circle r={3} fill="rgba(255,215,0,0.7)" />
        <Circle
          r={5.5}
          fill="none"
          stroke="rgba(255,215,0,0.4)"
          strokeWidth={0.8}
        />
      </G>
    </Svg>
  );
}

export function RosetteIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 28 28">
      <G transform="translate(14,14)">
        <Circle
          cx={0}
          cy={-5}
          r={5}
          fill="none"
          stroke="rgba(255,215,0,0.5)"
          strokeWidth={0.8}
        />
        <Circle
          cx={4.33}
          cy={-2.5}
          r={5}
          fill="none"
          stroke="rgba(255,215,0,0.45)"
          strokeWidth={0.8}
        />
        <Circle
          cx={4.33}
          cy={2.5}
          r={5}
          fill="none"
          stroke="rgba(255,215,0,0.4)"
          strokeWidth={0.8}
        />
        <Circle
          cx={0}
          cy={5}
          r={5}
          fill="none"
          stroke="rgba(255,215,0,0.45)"
          strokeWidth={0.8}
        />
        <Circle
          cx={-4.33}
          cy={2.5}
          r={5}
          fill="none"
          stroke="rgba(255,215,0,0.4)"
          strokeWidth={0.8}
        />
        <Circle
          cx={-4.33}
          cy={-2.5}
          r={5}
          fill="none"
          stroke="rgba(255,215,0,0.5)"
          strokeWidth={0.8}
        />
        <Circle r={2} fill="rgba(255,215,0,0.6)" />
      </G>
    </Svg>
  );
}

export function HexKnotIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 28 28">
      <G transform="translate(14,14)">
        <Polygon
          points="0,-10 8.66,-5 8.66,5 0,10 -8.66,5 -8.66,-5"
          fill="none"
          stroke="rgba(255,215,0,0.6)"
          strokeWidth={1}
        />
        <Polygon
          points="0,-6 5.2,-3 5.2,3 0,6 -5.2,3 -5.2,-3"
          fill="none"
          stroke="rgba(255,215,0,0.45)"
          strokeWidth={0.8}
          rotation={30}
          origin="0,0"
        />
        {[0, 60, 120, 180, 240, 300].map(angle => (
          <Line
            key={angle}
            x1={0}
            y1={-10}
            x2={0}
            y2={-6}
            stroke="rgba(255,215,0,0.3)"
            strokeWidth={0.6}
            rotation={angle}
            origin="0,0"
          />
        ))}
        <Circle r={2} fill="rgba(255,215,0,0.5)" />
      </G>
    </Svg>
  );
}

export function ArchesIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 28 28">
      <Path
        d="M4 24 Q4 10, 14 4 Q24 10, 24 24"
        fill="none"
        stroke="rgba(255,215,0,0.6)"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <Path
        d="M7 24 Q7 13, 14 8 Q21 13, 21 24"
        fill="none"
        stroke="rgba(255,215,0,0.45)"
        strokeWidth={1}
        strokeLinecap="round"
      />
      <Path
        d="M10 24 Q10 16, 14 12 Q18 16, 18 24"
        fill="none"
        stroke="rgba(255,215,0,0.3)"
        strokeWidth={0.8}
        strokeLinecap="round"
      />
      <Circle cx={14} cy={6} r={1.5} fill="rgba(255,215,0,0.5)" />
    </Svg>
  );
}

// ===== D3 BLOOM ICONS =====

export function PetalIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26">
      <G transform="translate(13,13)">
        <Ellipse
          rx={3}
          ry={8}
          fill="rgba(244,63,94,0.6)"
          rotation={0}
          origin="0,0"
        />
        <Ellipse
          rx={3}
          ry={8}
          fill="rgba(168,85,247,0.5)"
          rotation={60}
          origin="0,0"
        />
        <Ellipse
          rx={3}
          ry={8}
          fill="rgba(244,63,94,0.4)"
          rotation={120}
          origin="0,0"
        />
        <Circle r={3} fill="rgba(255,255,255,0.7)" />
      </G>
    </Svg>
  );
}

export function SpiralRoseIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26">
      <G transform="translate(13,13)">
        <Path
          d="M0 0 Q5 -8, 0 -9"
          fill="none"
          stroke="rgba(244,63,94,0.7)"
          strokeWidth={1.2}
          strokeLinecap="round"
        />
        <Path
          d="M0 0 Q9 -3, 9 2"
          fill="none"
          stroke="rgba(168,85,247,0.6)"
          strokeWidth={1.2}
          strokeLinecap="round"
        />
        <Path
          d="M0 0 Q4 9, -2 9"
          fill="none"
          stroke="rgba(244,63,94,0.5)"
          strokeWidth={1.2}
          strokeLinecap="round"
        />
        <Path
          d="M0 0 Q-9 4, -9 -1"
          fill="none"
          stroke="rgba(168,85,247,0.5)"
          strokeWidth={1.2}
          strokeLinecap="round"
        />
        <Circle
          r={10}
          fill="none"
          stroke="rgba(244,63,94,0.15)"
          strokeWidth={0.6}
        />
        <Circle r={2} fill="rgba(244,63,94,0.6)" />
      </G>
    </Svg>
  );
}

export function ButterflyIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 28 28">
      <G transform="translate(14,14)">
        <Path
          d="M0 0 Q-10 -8, -6 -2 Q-12 2, 0 0"
          fill="rgba(244,63,94,0.4)"
          stroke="rgba(244,63,94,0.6)"
          strokeWidth={0.8}
        />
        <Path
          d="M0 0 Q-10 8, -6 2 Q-12 -2, 0 0"
          fill="rgba(168,85,247,0.35)"
          stroke="rgba(168,85,247,0.5)"
          strokeWidth={0.8}
        />
        <Path
          d="M0 0 Q10 -8, 6 -2 Q12 2, 0 0"
          fill="rgba(168,85,247,0.35)"
          stroke="rgba(168,85,247,0.5)"
          strokeWidth={0.8}
        />
        <Path
          d="M0 0 Q10 8, 6 2 Q12 -2, 0 0"
          fill="rgba(244,63,94,0.4)"
          stroke="rgba(244,63,94,0.6)"
          strokeWidth={0.8}
        />
        <Circle r={1.5} fill="rgba(255,255,255,0.7)" />
      </G>
    </Svg>
  );
}

export function DahliaIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 28 28">
      <G transform="translate(14,14)">
        {[0, 45, 90, 135].map((angle, i) => (
          <Ellipse
            key={`outer-${angle}`}
            rx={2.5}
            ry={10}
            fill={i % 2 === 0 ? 'rgba(244,63,94,0.25)' : 'rgba(168,85,247,0.2)'}
            rotation={angle}
            origin="0,0"
          />
        ))}
        {[22.5, 67.5, 112.5, 157.5].map((angle, i) => (
          <Ellipse
            key={`inner-${angle}`}
            rx={2}
            ry={6.5}
            fill={i % 2 === 0 ? 'rgba(244,63,94,0.4)' : 'rgba(168,85,247,0.35)'}
            rotation={angle}
            origin="0,0"
          />
        ))}
        <Circle r={3} fill="rgba(255,255,255,0.6)" />
        <Circle r={1.5} fill="rgba(244,63,94,0.5)" />
      </G>
    </Svg>
  );
}

// ===== D4 AURORA ICONS =====

export function OrbitalIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 30 30">
      <Defs>
        <LinearGradient id="aOrbG1" x1="0" y1="0" x2="30" y2="30">
          <Stop offset="0" stopColor="#34d399" />
          <Stop offset="1" stopColor="#38bdf8" />
        </LinearGradient>
        <LinearGradient id="aOrbG2" x1="0" y1="30" x2="30" y2="0">
          <Stop offset="0" stopColor="#38bdf8" />
          <Stop offset="1" stopColor="#a78bfa" />
        </LinearGradient>
        <LinearGradient id="aOrbG3" x1="0" y1="15" x2="30" y2="15">
          <Stop offset="0" stopColor="#a78bfa" />
          <Stop offset="1" stopColor="#34d399" />
        </LinearGradient>
      </Defs>
      <Ellipse
        cx={15}
        cy={15}
        rx={12}
        ry={6}
        stroke="url(#aOrbG1)"
        strokeWidth={1.3}
        fill="none"
        rotation={-30}
        origin="15,15"
      />
      <Ellipse
        cx={15}
        cy={15}
        rx={12}
        ry={6}
        stroke="url(#aOrbG2)"
        strokeWidth={1.3}
        fill="none"
        rotation={30}
        origin="15,15"
      />
      <Ellipse
        cx={15}
        cy={15}
        rx={12}
        ry={6}
        stroke="url(#aOrbG3)"
        strokeWidth={1.3}
        fill="none"
        rotation={90}
        origin="15,15"
      />
      <Circle cx={15} cy={15} r={2.5} fill="url(#aOrbG1)" />
    </Svg>
  );
}

export function RippleIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 28 28">
      <Defs>
        <LinearGradient id="aRipG1" x1="8" y1="8" x2="20" y2="20">
          <Stop offset="0" stopColor="#34d399" />
          <Stop offset="1" stopColor="#38bdf8" />
        </LinearGradient>
        <LinearGradient id="aRipG2" x1="5" y1="5" x2="23" y2="23">
          <Stop offset="0" stopColor="#38bdf8" />
          <Stop offset="1" stopColor="#a78bfa" />
        </LinearGradient>
      </Defs>
      <Circle cx={14} cy={14} r={3} fill="url(#aRipG1)" />
      <Circle
        cx={14}
        cy={14}
        r={6}
        stroke="url(#aRipG1)"
        strokeWidth={1}
        fill="none"
        opacity={0.7}
      />
      <Circle
        cx={14}
        cy={14}
        r={9}
        stroke="url(#aRipG2)"
        strokeWidth={0.8}
        fill="none"
        opacity={0.5}
      />
      <Circle
        cx={14}
        cy={14}
        r={12}
        stroke="url(#aRipG2)"
        strokeWidth={0.6}
        fill="none"
        opacity={0.3}
      />
      <Circle cx={14} cy={2} r={1.2} fill="rgba(52,211,153,0.6)" />
      <Circle cx={26} cy={14} r={1.2} fill="rgba(56,189,248,0.6)" />
      <Circle cx={14} cy={26} r={1.2} fill="rgba(167,139,250,0.6)" />
      <Circle cx={2} cy={14} r={1.2} fill="rgba(244,63,94,0.4)" />
    </Svg>
  );
}

export function VesicaIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 28 28">
      <Defs>
        <RadialGradient id="aVesG">
          <Stop offset="0" stopColor="#38bdf8" />
          <Stop offset="1" stopColor="#a78bfa" />
        </RadialGradient>
      </Defs>
      <Circle
        cx={14}
        cy={10}
        r={5}
        stroke="rgba(52,211,153,0.7)"
        strokeWidth={1}
        fill="none"
      />
      <Circle
        cx={10}
        cy={16}
        r={5}
        stroke="rgba(56,189,248,0.7)"
        strokeWidth={1}
        fill="none"
      />
      <Circle
        cx={18}
        cy={16}
        r={5}
        stroke="rgba(167,139,250,0.7)"
        strokeWidth={1}
        fill="none"
      />
      <Circle cx={14} cy={14} r={2} fill="url(#aVesG)" opacity={0.6} />
      <Circle
        cx={14}
        cy={14}
        r={12}
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={0.5}
        fill="none"
      />
    </Svg>
  );
}

// ===== D5 MOSAIC ICONS =====

export function ColorGridIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 24 24">
      <Rect
        x={3}
        y={3}
        width={7}
        height={7}
        rx={2}
        fill="rgba(251,191,36,0.5)"
      />
      <Rect
        x={14}
        y={3}
        width={7}
        height={7}
        rx={2}
        fill="rgba(239,68,68,0.4)"
      />
      <Rect
        x={3}
        y={14}
        width={7}
        height={7}
        rx={2}
        fill="rgba(52,211,153,0.4)"
      />
      <Rect
        x={14}
        y={14}
        width={7}
        height={7}
        rx={2}
        fill="rgba(139,92,246,0.45)"
      />
    </Svg>
  );
}

export function ScatteredIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26">
      <Rect
        x={2}
        y={4}
        width={6}
        height={6}
        rx={1.5}
        fill="rgba(251,191,36,0.6)"
        rotation={-8}
        origin="5,7"
      />
      <Rect
        x={10}
        y={2}
        width={5}
        height={5}
        rx={1.5}
        fill="rgba(239,68,68,0.5)"
        rotation={12}
        origin="12.5,4.5"
      />
      <Rect
        x={17}
        y={6}
        width={6}
        height={6}
        rx={1.5}
        fill="rgba(56,189,248,0.5)"
        rotation={-5}
        origin="20,9"
      />
      <Rect
        x={4}
        y={14}
        width={5}
        height={5}
        rx={1.5}
        fill="rgba(52,211,153,0.5)"
        rotation={8}
        origin="6.5,16.5"
      />
      <Rect
        x={12}
        y={13}
        width={6}
        height={6}
        rx={1.5}
        fill="rgba(139,92,246,0.5)"
        rotation={-10}
        origin="15,16"
      />
      <Rect
        x={19}
        y={16}
        width={5}
        height={5}
        rx={1.5}
        fill="rgba(236,72,153,0.4)"
        rotation={15}
        origin="21.5,18.5"
      />
    </Svg>
  );
}

export function ZelligeIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26">
      <G transform="translate(13,13)">
        <Path d="M0 -10L3 -3L0 0L-3 -3Z" fill="rgba(251,191,36,0.5)" />
        <Path d="M10 0L3 3L0 0L3 -3Z" fill="rgba(239,68,68,0.4)" />
        <Path d="M0 10L-3 3L0 0L3 3Z" fill="rgba(52,211,153,0.4)" />
        <Path d="M-10 0L-3 -3L0 0L-3 3Z" fill="rgba(56,189,248,0.4)" />
        <Path d="M7 -7L3 -1L0 0L1 -3Z" fill="rgba(139,92,246,0.35)" />
        <Path d="M7 7L1 3L0 0L3 1Z" fill="rgba(236,72,153,0.3)" />
        <Path d="M-7 7L-1 3L0 0L-3 1Z" fill="rgba(251,191,36,0.35)" />
        <Path d="M-7 -7L-3 -1L0 0L-1 -3Z" fill="rgba(239,68,68,0.3)" />
        <Circle r={1.5} fill="rgba(255,255,255,0.6)" />
      </G>
    </Svg>
  );
}

export function StainedGlassIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26">
      <Circle
        cx={13}
        cy={13}
        r={11}
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={0.8}
      />
      <Path
        d="M13 13L13 2A11 11 0 0 1 22.5 7.5Z"
        fill="rgba(251,191,36,0.45)"
      />
      <Path d="M13 13L22.5 7.5A11 11 0 0 1 24 13Z" fill="rgba(239,68,68,0.4)" />
      <Path
        d="M13 13L24 13A11 11 0 0 1 22.5 18.5Z"
        fill="rgba(56,189,248,0.4)"
      />
      <Path
        d="M13 13L22.5 18.5A11 11 0 0 1 13 24Z"
        fill="rgba(139,92,246,0.4)"
      />
      <Path
        d="M13 13L13 24A11 11 0 0 1 3.5 18.5Z"
        fill="rgba(52,211,153,0.4)"
      />
      <Path
        d="M13 13L3.5 18.5A11 11 0 0 1 2 13Z"
        fill="rgba(236,72,153,0.35)"
      />
      <Path d="M13 13L2 13A11 11 0 0 1 3.5 7.5Z" fill="rgba(251,191,36,0.35)" />
      <Path d="M13 13L3.5 7.5A11 11 0 0 1 13 2Z" fill="rgba(244,63,94,0.35)" />
      <Circle
        cx={13}
        cy={13}
        r={3}
        fill="rgba(255,255,255,0.15)"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={0.5}
      />
    </Svg>
  );
}

// ===== D7 MESH ICONS =====

export function PrismIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 28 28">
      <Path
        d="M14 4L24 22H4Z"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth={1.3}
        strokeLinejoin="round"
        fill="none"
      />
      <Line
        x1={20}
        y1={15}
        x2={26}
        y2={12}
        stroke="rgba(244,63,94,0.6)"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <Line
        x1={20}
        y1={17}
        x2={26}
        y2={16}
        stroke="rgba(251,191,36,0.6)"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <Line
        x1={20}
        y1={19}
        x2={26}
        y2={20}
        stroke="rgba(52,211,153,0.6)"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <Line
        x1={19}
        y1={20.5}
        x2={25}
        y2={23}
        stroke="rgba(56,189,248,0.5)"
        strokeWidth={1}
        strokeLinecap="round"
      />
      <Line
        x1={2}
        y1={14}
        x2={10}
        y2={14}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={1}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function DiceIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26">
      <Rect
        x={3}
        y={3}
        width={20}
        height={20}
        rx={4}
        stroke="rgba(255,255,255,0.5)"
        strokeWidth={1.2}
        fill="none"
      />
      <Circle cx={8.5} cy={8.5} r={2} fill="rgba(139,92,246,0.7)" />
      <Circle cx={17.5} cy={8.5} r={2} fill="rgba(236,72,153,0.6)" />
      <Circle cx={13} cy={13} r={2} fill="rgba(56,189,248,0.6)" />
      <Circle cx={8.5} cy={17.5} r={2} fill="rgba(52,211,153,0.6)" />
      <Circle cx={17.5} cy={17.5} r={2} fill="rgba(251,191,36,0.6)" />
    </Svg>
  );
}

export function PinwheelIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 28 28">
      <G transform="translate(14,14)">
        {[
          {angle: 0, fill: 'rgba(139,92,246,0.6)'},
          {angle: 60, fill: 'rgba(236,72,153,0.5)'},
          {angle: 120, fill: 'rgba(56,189,248,0.5)'},
          {angle: 180, fill: 'rgba(52,211,153,0.45)'},
          {angle: 240, fill: 'rgba(251,191,36,0.45)'},
          {angle: 300, fill: 'rgba(244,63,94,0.4)'},
        ].map(({angle, fill}) => (
          <Path
            key={angle}
            d="M0 0L-3 -12L3 -12Z"
            fill={fill}
            rotation={angle}
            origin="0,0"
          />
        ))}
        <Circle r={2.5} fill="rgba(255,255,255,0.7)" />
      </G>
    </Svg>
  );
}

export function ConstellationIcon() {
  return (
    <Svg width={S} height={S} viewBox="0 0 28 28">
      {/* Connections */}
      <Line
        x1={7}
        y1={7}
        x2={14}
        y2={5}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={0.8}
      />
      <Line
        x1={14}
        y1={5}
        x2={22}
        y2={9}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={0.8}
      />
      <Line
        x1={22}
        y1={9}
        x2={20}
        y2={18}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={0.8}
      />
      <Line
        x1={20}
        y1={18}
        x2={12}
        y2={22}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={0.8}
      />
      <Line
        x1={12}
        y1={22}
        x2={7}
        y2={7}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={0.8}
      />
      <Line
        x1={7}
        y1={7}
        x2={20}
        y2={18}
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={0.6}
      />
      <Line
        x1={14}
        y1={5}
        x2={12}
        y2={22}
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={0.6}
      />
      {/* Nodes */}
      <Circle cx={7} cy={7} r={2.5} fill="rgba(139,92,246,0.7)" />
      <Circle cx={14} cy={5} r={2} fill="rgba(56,189,248,0.7)" />
      <Circle cx={22} cy={9} r={2.5} fill="rgba(236,72,153,0.6)" />
      <Circle cx={20} cy={18} r={2} fill="rgba(52,211,153,0.7)" />
      <Circle cx={12} cy={22} r={2.5} fill="rgba(251,191,36,0.6)" />
      <Circle cx={14} cy={13} r={1.5} fill="rgba(255,255,255,0.4)" />
    </Svg>
  );
}

// Icon lookup map
export const ICON_MAP: Record<string, Record<string, React.FC>> = {
  arabesque: {
    'ornate-star': OrnateStarIcon,
    rosette: RosetteIcon,
    'hex-knot': HexKnotIcon,
    arches: ArchesIcon,
  },
  bloom: {
    petal: PetalIcon,
    'spiral-rose': SpiralRoseIcon,
    butterfly: ButterflyIcon,
    dahlia: DahliaIcon,
  },
  aurora: {
    orbital: OrbitalIcon,
    ripple: RippleIcon,
    vesica: VesicaIcon,
  },
  mosaic: {
    'color-grid': ColorGridIcon,
    scattered: ScatteredIcon,
    zellige: ZelligeIcon,
    'stained-glass': StainedGlassIcon,
  },
  mesh: {
    prism: PrismIcon,
    dice: DiceIcon,
    pinwheel: PinwheelIcon,
    constellation: ConstellationIcon,
  },
};
