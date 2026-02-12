import {Dimensions} from 'react-native';
import {
  FLOATING_PLAYER_HEIGHT,
  TAB_BAR_HEIGHT,
  FLOATING_PLAYER_BOTTOM_MARGIN,
} from '@/utils/constants';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

export const IS_COMPACT_DEVICE = SCREEN_HEIGHT < 700;

// Reserve space at the bottom for the floating player + tab bar
export const PLAYER_RESERVED_HEIGHT =
  FLOATING_PLAYER_HEIGHT + TAB_BAR_HEIGHT + FLOATING_PLAYER_BOTTOM_MARGIN;

export const PAGE_PADDING_HORIZONTAL = IS_COMPACT_DEVICE ? 8 : 16;
export const PAGE_PADDING_TOP = IS_COMPACT_DEVICE ? 30 : 110;
export const PAGE_PADDING_BOTTOM = IS_COMPACT_DEVICE
  ? PLAYER_RESERVED_HEIGHT + 15
  : PLAYER_RESERVED_HEIGHT + 40;
export const AYAH_LINE_SPACING = IS_COMPACT_DEVICE ? 0.75 : 0.7;
export const LINES_PER_PAGE = 15;

export const CONTENT_WIDTH = SCREEN_WIDTH - PAGE_PADDING_HORIZONTAL * 2;
export const CONTENT_HEIGHT =
  SCREEN_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;
export const BASE_LINE_HEIGHT = CONTENT_HEIGHT / LINES_PER_PAGE;

export {SCREEN_WIDTH, SCREEN_HEIGHT};

export const SURAH_NAMES: Record<number, string> = {
  1: 'الفاتحة',
  2: 'البقرة',
  3: 'آل عمران',
  4: 'النساء',
  5: 'المائدة',
  6: 'الأنعام',
  7: 'الأعراف',
  8: 'الأنفال',
  9: 'التوبة',
  10: 'يونس',
  11: 'هود',
  12: 'يوسف',
  13: 'الرعد',
  14: 'إبراهيم',
  15: 'الحجر',
  16: 'النحل',
  17: 'الإسراء',
  18: 'الكهف',
  19: 'مريم',
  20: 'طه',
  21: 'الأنبياء',
  22: 'الحج',
  23: 'المؤمنون',
  24: 'النور',
  25: 'الفرقان',
  26: 'الشعراء',
  27: 'النمل',
  28: 'القصص',
  29: 'العنكبوت',
  30: 'الروم',
  31: 'لقمان',
  32: 'السجدة',
  33: 'الأحزاب',
  34: 'سبأ',
  35: 'فاطر',
  36: 'يس',
  37: 'الصافات',
  38: 'ص',
  39: 'الزمر',
  40: 'غافر',
  41: 'فصلت',
  42: 'الشورى',
  43: 'الزخرف',
  44: 'الدخان',
  45: 'الجاثية',
  46: 'الأحقاف',
  47: 'محمد',
  48: 'الفتح',
  49: 'الحجرات',
  50: 'ق',
  51: 'الذاريات',
  52: 'الطور',
  53: 'النجم',
  54: 'القمر',
  55: 'الرحمن',
  56: 'الواقعة',
  57: 'الحديد',
  58: 'المجادلة',
  59: 'الحشر',
  60: 'الممتحنة',
  61: 'الصف',
  62: 'الجمعة',
  63: 'المنافقون',
  64: 'التغابن',
  65: 'الطلاق',
  66: 'التحريم',
  67: 'الملك',
  68: 'القلم',
  69: 'الحاقة',
  70: 'المعارج',
  71: 'نوح',
  72: 'الجن',
  73: 'المزمل',
  74: 'المدثر',
  75: 'القيامة',
  76: 'الإنسان',
  77: 'المرسلات',
  78: 'النبأ',
  79: 'النازعات',
  80: 'عبس',
  81: 'التكوير',
  82: 'الانفطار',
  83: 'المطففين',
  84: 'الانشقاق',
  85: 'البروج',
  86: 'الطارق',
  87: 'الأعلى',
  88: 'الغاشية',
  89: 'الفجر',
  90: 'البلد',
  91: 'الشمس',
  92: 'الليل',
  93: 'الضحى',
  94: 'الشرح',
  95: 'التين',
  96: 'العلق',
  97: 'القدر',
  98: 'البينة',
  99: 'الزلزلة',
  100: 'العاديات',
  101: 'القارعة',
  102: 'التكاثر',
  103: 'العصر',
  104: 'الهمزة',
  105: 'الفيل',
  106: 'قريش',
  107: 'الماعون',
  108: 'الكوثر',
  109: 'الكافرون',
  110: 'النصر',
  111: 'المسد',
  112: 'الإخلاص',
  113: 'الفلق',
  114: 'الناس',
};

/**
 * Calculate Y positions for mushaf page lines, accounting for line type heights.
 * - surah_name lines get 1.2x base height
 * - ayah/basmallah lines get AYAH_LINE_SPACING base height
 * - Pages 1-2 center content vertically
 * - Other pages scale to fill CONTENT_HEIGHT
 */
export function calculateLineYPositions(
  lines: {line_type: string}[],
  pageNumber: number,
): number[] {
  const linePositions: number[] = [];
  let currentY = 0;
  for (let i = 0; i < lines.length; i++) {
    linePositions.push(currentY);
    const lineHeight =
      lines[i].line_type === 'surah_name'
        ? BASE_LINE_HEIGHT * 1.2
        : BASE_LINE_HEIGHT * AYAH_LINE_SPACING;
    currentY += lineHeight;
  }
  const totalContentHeight = currentY;
  const shouldCenter = pageNumber === 1 || pageNumber === 2;

  const yPositions: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (shouldCenter) {
      yPositions.push(
        linePositions[i] + (CONTENT_HEIGHT - totalContentHeight) / 2,
      );
    } else {
      const scaleFactor = CONTENT_HEIGHT / totalContentHeight;
      yPositions.push(linePositions[i] * scaleFactor);
    }
  }
  return yPositions;
}
