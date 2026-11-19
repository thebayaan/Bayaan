// @ai-start
// The rendering constants of the vertical scroll (ContinuousMushafView), from
// the live layout metrics. The view builds them; its two page renderers
// (MushafPageContent, ContinuousQCFPage) draw with them.
import {PAGE_WIDTH, MARGIN, FONTSIZE} from '@/services/mushaf/QuranTextService';
import {type MushafLayoutMetrics} from '../constants';
// @ai-end

// Rendering constants are now derived from live `metrics` (see
// `useRenderConstants` below). On phones the old frozen values are
// reproduced exactly; on iPad we use the capped page width so fonts
// stay readable and lines don't overlap.
export interface RenderConstants {
  screenWidth: number;
  contentWidth: number;
  pageOffsetX: number;
  baseLineHeight: number;
  renderScale: number;
  skiaMargin: number;
  lineWidth: number;
  skiaFontSize: number;
  fontSizeLineWidthRatio: number;
  canvasMarginX: number;
}

// Ratio of line-height to content-width that matches the phone's visual
// density (derived from legacy constants: 41pt line height at 412pt content
// width). Used for the continuous vertical view so each page's height stays
// proportional to its width regardless of container height.
const CONTINUOUS_LINE_HEIGHT_RATIO = 0.1;

export function buildRenderConstants(
  metrics: MushafLayoutMetrics,
): RenderConstants {
  const {screenWidth, contentWidth, pageOffsetX} = metrics;
  const renderScale = contentWidth / PAGE_WIDTH;
  const skiaMargin = MARGIN * renderScale;
  const lineWidth = contentWidth - 2 * skiaMargin;
  const skiaFontSize = FONTSIZE * renderScale * 0.9;
  const fontSizeLineWidthRatio = skiaFontSize / lineWidth;
  // Horizontal offset from the FlatList item's left edge to the Canvas.
  // On phone: centers the content within the view (legacy behavior).
  // On iPad: adds `pageOffsetX` so the (capped) page sits centered in the
  // full container width.
  // @ai On an iOS phone in landscape, pageOffsetX is the left cutout inset
  // and pageWidth leaves out both insets.
  const canvasMarginX = pageOffsetX + (metrics.pageWidth - contentWidth) / 2;
  // Decouple line-height from container-height for the continuous view so
  // each page's vertical footprint scales with its width (preserves the
  // "continuous scroll" feel on iPad instead of each page filling the whole
  // viewport). Still honor the metric's value if it produces a tighter
  // layout (i.e. short screens).
  const baseLineHeight = Math.min(
    metrics.baseLineHeight,
    contentWidth * CONTINUOUS_LINE_HEIGHT_RATIO,
  );
  return {
    screenWidth,
    contentWidth,
    pageOffsetX,
    baseLineHeight,
    renderScale,
    skiaMargin,
    lineWidth,
    skiaFontSize,
    fontSizeLineWidthRatio,
    canvasMarginX,
  };
}
