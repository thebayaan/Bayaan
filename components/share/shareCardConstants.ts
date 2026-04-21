/** Share-card canvas dimensions, colors, and typography sizes. */

export const CARD_WIDTH = 1080;
export const CARD_PADDING = 60;
export const CARD_CONTENT_WIDTH = CARD_WIDTH - CARD_PADDING * 2;

// Typography
export const CARD_VERSE_FONT_SIZE = 48;
export const CARD_WATERMARK_FONT_SIZE = 22;
export const CARD_WATERMARK_ICON_SIZE = 28;
export const CARD_WATERMARK_GAP = 8;
export const CARD_VERSE_LINE_HEIGHT = 1.8;

// Surah header sizing relative to content width
export const CARD_HEADER_NAME_RATIO = 0.4; // name font = divider font * ratio

// Vertical spacing
export const CARD_TOP_PADDING = 50;
export const CARD_HEADER_BOTTOM_GAP = 40;
export const CARD_VERSE_BOTTOM_GAP = 30;
export const CARD_BOTTOM_PADDING = 40;

// Cross-surah gap (space before a second surah header)
export const CARD_SURAH_GAP = 30;

// Basmallah sizing
export const CARD_BASMALLAH_FONT_RATIO = 0.85; // relative to verse font size
export const CARD_BASMALLAH_BOTTOM_GAP = 12;

export interface ShareCardColors {
  background: string;
  text: string;
  secondary: string;
  divider: string;
}

export const LIGHT_COLORS: ShareCardColors = {
  background: '#f4f3ec',
  text: '#06151C',
  secondary: '#052c39',
  divider: '#052c39',
};

export const DARK_COLORS: ShareCardColors = {
  background: '#050b10',
  text: '#e8e8e8',
  secondary: '#B0B0B0',
  divider: '#B0B0B0',
};

/** Raw SVG path `d` for the Bayaan starburst logo (bounding box ~1023×872). */
export const STARBURST_PATH_DATA =
  'M1023 480.093H671.123L996.615 346.416L972.669 288.1L641.861 423.97L892.693 169.029L847.815 124.853L604.737 371.902L739.646 52.616L681.644 28.0892L543.008 356.172V0H479.992V351.951L346.343 26.3902L288.039 50.314L423.88 381.219L168.993 130.307L124.827 175.222L371.823 418.352L52.6049 283.414L28.0833 341.428L356.096 480.093H0V543.123H436.346L381.139 599.247L238.064 748.133L282.943 792.309L418.263 651.314L418.291 651.287L479.992 588.531V667.044V872H543.008V586.778L599.12 641.997L747.975 785.101L792.141 740.213L651.177 604.864L651.149 604.837L588.407 543.123H666.903H1023V480.093Z';
