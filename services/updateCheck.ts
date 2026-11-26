// @ai-generated
// RFC-025 — "update available" check.
//
// A tenant sets `branding.updateSource`: a function that resolves the newest
// build number it recommends for each platform. This module compares that
// number with the build number of the installed binary, and builds the store
// link from branding. It never blocks the app and never throws.
//
// `branding.updateSource` absent → `checkForUpdate()` resolves
// `{updateAvailable: false, storeUrl: null}` and makes no request.
// Bayaan ships it absent.

import {Linking, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import branding from '@/config/branding';

/** The recommended build for one platform. `null` = no recommendation. */
export interface PlatformUpdateInfo {
  recommended: number | null;
}

/** What an update source resolves. An absent platform = no recommendation. */
export interface UpdateInfo {
  ios?: PlatformUpdateInfo;
  android?: PlatformUpdateInfo;
}

/**
 * Resolves the recommended build numbers, or `null` when the tenant has
 * nothing to say. A source may reject: the check treats that as "no update".
 */
export type UpdateSource = () => Promise<UpdateInfo | null>;

export interface UpdateCheckResult {
  updateAvailable: boolean;
  /** The store page of this app on this platform; null when unknown. */
  storeUrl: string | null;
}

export type StorePlatform = 'ios' | 'android';

export const UPDATE_SOURCE_TIMEOUT_MS = 3000;
export const UPDATE_CARD_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
export const UPDATE_CARD_SNOOZE_KEY = `@${branding.appSlug}:updateCardSnoozedUntil`;

const NO_UPDATE: UpdateCheckResult = {updateAvailable: false, storeUrl: null};

function currentPlatform(): StorePlatform | null {
  return Platform.OS === 'ios' || Platform.OS === 'android'
    ? Platform.OS
    : null;
}

/**
 * The build number of the installed binary: `CFBundleVersion` on iOS, the
 * `versionCode` on Android. It comes from the native layer, so an
 * over-the-air JS update does not change it. Null when it is not a positive
 * integer.
 */
export function getRunningBuildNumber(): number | null {
  const raw = Application.nativeBuildVersion;
  if (raw == null || raw === '') return null;
  const build = Number(raw);
  return Number.isInteger(build) && build > 0 ? build : null;
}

/**
 * The store page of this app. iOS needs `branding.appStoreId`. With no id
 * there is no iOS link, because any other page belongs to another app.
 */
export function getStoreUrl(
  platform: StorePlatform | null = currentPlatform(),
): string | null {
  if (platform === 'ios') {
    return branding.appStoreId
      ? `itms-apps://apps.apple.com/app/id${branding.appStoreId}`
      : null;
  }
  if (platform === 'android') {
    return `market://details?id=${branding.bundleId.android}`;
  }
  return null;
}

function getWebStoreUrl(platform: StorePlatform): string | null {
  if (platform === 'ios') {
    return branding.appStoreId
      ? `https://apps.apple.com/app/id${branding.appStoreId}`
      : null;
  }
  return `https://play.google.com/store/apps/details?id=${branding.bundleId.android}`;
}

function readRecommended(
  info: unknown,
  platform: StorePlatform,
): number | null {
  if (info == null || typeof info !== 'object') return null;
  const entry = (info as Record<string, unknown>)[platform];
  if (entry == null || typeof entry !== 'object') return null;
  const recommended = (entry as Record<string, unknown>).recommended;
  return typeof recommended === 'number' &&
    Number.isInteger(recommended) &&
    recommended > 0
    ? recommended
    : null;
}

function resolveWithin<T>(
  run: () => Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    Promise.resolve()
      .then(run)
      .then(
        value => {
          clearTimeout(timer);
          resolve(value);
        },
        () => {
          clearTimeout(timer);
          resolve(null);
        },
      );
  });
}

export interface CheckForUpdateOptions {
  /** Defaults to `branding.updateSource`. */
  source?: UpdateSource;
  /** Defaults to `Platform.OS`. */
  platform?: StorePlatform | null;
  /** Defaults to `getRunningBuildNumber()`. */
  runningBuild?: number | null;
  /** Defaults to `UPDATE_SOURCE_TIMEOUT_MS`. */
  timeoutMs?: number;
}

/**
 * Asks the update source, and compares its recommended build with the
 * running build. An update is available only when the recommended build is
 * strictly higher and a store link exists. Each failure resolves "no update".
 */
export async function checkForUpdate(
  options: CheckForUpdateOptions = {},
): Promise<UpdateCheckResult> {
  const source = options.source ?? branding.updateSource;
  if (!source) return NO_UPDATE;

  const platform =
    options.platform === undefined ? currentPlatform() : options.platform;
  if (!platform) return NO_UPDATE;

  const runningBuild =
    options.runningBuild === undefined
      ? getRunningBuildNumber()
      : options.runningBuild;
  if (runningBuild == null) return NO_UPDATE;

  const storeUrl = getStoreUrl(platform);
  if (storeUrl == null) return NO_UPDATE;

  const info = await resolveWithin(
    source,
    options.timeoutMs ?? UPDATE_SOURCE_TIMEOUT_MS,
  );
  const recommended = readRecommended(info, platform);
  if (recommended == null) return NO_UPDATE;

  return recommended > runningBuild
    ? {updateAvailable: true, storeUrl}
    : NO_UPDATE;
}

/**
 * Starts the update. A tenant's `branding.openUpdate` runs first, with the
 * store link (for example to start the Play in-app update sheet). When it is
 * absent, resolves false, or fails, this opens the store page of this app,
 * and then the web page of the store when the store app does not open the
 * deep link. With no store link (iOS without `appStoreId`), nothing runs.
 */
export async function openStoreForUpdate(
  platform: StorePlatform | null = currentPlatform(),
): Promise<void> {
  if (!platform) return;
  const storeUrl = getStoreUrl(platform);
  if (!storeUrl) return;
  if (branding.openUpdate) {
    try {
      if (await branding.openUpdate(storeUrl)) return;
    } catch {
      // Fall through to the store link.
    }
  }
  try {
    await Linking.openURL(storeUrl);
  } catch {
    const webUrl = getWebStoreUrl(platform);
    if (!webUrl) return;
    try {
      await Linking.openURL(webUrl);
    } catch {
      // Nothing more to try. The card stays, so the person can try again.
    }
  }
}

/** Hides the card for 7 days. */
export async function snoozeUpdateCard(
  now: number = Date.now(),
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      UPDATE_CARD_SNOOZE_KEY,
      String(now + UPDATE_CARD_SNOOZE_MS),
    );
  } catch {
    // A failed write only means that the card can show again.
  }
}

/** True while a close of the card is less than 7 days old. */
export async function isUpdateCardSnoozed(
  now: number = Date.now(),
): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(UPDATE_CARD_SNOOZE_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && until > now;
  } catch {
    return false;
  }
}
