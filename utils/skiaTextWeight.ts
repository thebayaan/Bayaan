import {
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkColor,
  type SkPaint,
} from '@shopify/react-native-skia';
import type {MushafArabicTextWeight} from '@/store/mushafSettingsStore';

export const getArabicTextWeightStrokeWidth = (
  weight: MushafArabicTextWeight,
  fontSize: number,
): number => {
  switch (weight) {
    case 'medium':
      return Math.max(0.25, fontSize * 0.015);
    case 'bold':
      return Math.max(0.45, fontSize * 0.028);
    case 'normal':
    default:
      return 0;
  }
};

export const createTextStrokePaint = (
  color: SkColor,
  strokeWidth: number,
): SkPaint | undefined => {
  if (strokeWidth <= 0) return undefined;

  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(color);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(strokeWidth);
  paint.setStrokeCap(StrokeCap.Round);
  paint.setStrokeJoin(StrokeJoin.Round);
  return paint;
};
