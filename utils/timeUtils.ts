import {localizeDigits} from '@/i18n/format';

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return localizeDigits(
    `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`,
  );
}

export function formatDurationForDisplay(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return localizeDigits(
    `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`,
  );
}
