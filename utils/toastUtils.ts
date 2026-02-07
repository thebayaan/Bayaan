import * as Burnt from 'burnt';

/**
 * Show a native toast notification (cross-platform via burnt)
 */
export function showToast(title: string, message?: string): void {
  Burnt.toast({
    title,
    message,
    preset: 'done',
  });
}
