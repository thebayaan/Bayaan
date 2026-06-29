import type {Reciter, Rewayah} from '../types/reciter';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (n): n is number => typeof n === 'number' && Number.isFinite(n),
  );
}

function coerceId(value: unknown): string | null {
  if (typeof value === 'string') return value.length > 0 ? value : null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeRewayah(raw: unknown): Rewayah {
  if (!isObject(raw)) {
    return {
      id: '',
      reciter_id: '',
      name: '',
      style: '',
      server: '',
      source_type: '',
      surah_total: 0,
      surah_list: [],
      mp3quran_read_id: null,
      qdc_reciter_id: null,
      is_active: true,
      created_at: '',
      updated_at: '',
    };
  }
  return {
    id: asString(raw.id),
    reciter_id: asString(raw.reciter_id),
    name: asString(raw.name),
    style: asString(raw.style),
    server: asString(raw.server),
    source_type: asString(raw.source_type),
    surah_total: asNumber(raw.surah_total),
    surah_list: asNumberArray(raw.surah_list),
    mp3quran_read_id: coerceId(raw.mp3quran_read_id),
    qdc_reciter_id: coerceId(raw.qdc_reciter_id),
    is_active: asBoolean(raw.is_active, true),
    created_at: asString(raw.created_at),
    updated_at: asString(raw.updated_at),
  };
}

export function normalizeRewayat(raw: unknown): Rewayah[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeRewayah);
}

export function normalizeReciter(raw: unknown): Reciter {
  if (!isObject(raw)) {
    return {
      id: '',
      name: '',
      name_arabic: null,
      date: '',
      image_url: null,
      bio: null,
      slug: '',
      is_featured: false,
      is_active: true,
      created_at: '',
      updated_at: '',
      rewayat: [],
    };
  }
  const name = asString(raw.name);
  return {
    id: asString(raw.id),
    name,
    name_arabic: asStringOrNull(raw.name_arabic),
    date: asString(raw.date),
    image_url: asStringOrNull(raw.image_url),
    bio: asStringOrNull(raw.bio),
    slug: asString(raw.slug) || slugify(name),
    is_featured: asBoolean(raw.is_featured, false),
    is_active: asBoolean(raw.is_active, true),
    created_at: asString(raw.created_at),
    updated_at: asString(raw.updated_at),
    rewayat: normalizeRewayat(raw.rewayat),
  };
}

export function normalizeReciters(raw: unknown): Reciter[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (r): r is Record<string, unknown> =>
        isObject(r) && typeof r.id === 'string' && r.id.length > 0,
    )
    .map(normalizeReciter);
}
