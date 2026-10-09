// A leaf module (no imports) so the tafseer store can listen to engine
// installs without adding to the store -> contentSync import cycle.

export type InstallPhase = 'started' | 'finished';
export type InstallActivityListener = (
  key: string,
  phase: InstallPhase,
) => void;

let listener: InstallActivityListener | null = null;

export function setInstallActivityListener(
  next: InstallActivityListener | null,
): void {
  listener = next;
}

function report(key: string, phase: InstallPhase): void {
  try {
    listener?.(key, phase);
  } catch {
    // UI bookkeeping must never break an install.
  }
}

// Reports an engine-driven install (not started by the user) to the UI.
export async function reportInstall(
  key: string,
  task: () => Promise<void>,
): Promise<void> {
  report(key, 'started');
  try {
    await task();
  } finally {
    report(key, 'finished');
  }
}
