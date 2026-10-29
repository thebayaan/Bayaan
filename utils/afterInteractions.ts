// utils/afterInteractions.ts
// Stand-in for InteractionManager.runAfterInteractions, which React Native
// 0.87 removed. Runs the task once the JS thread is idle, so a screen push or
// animation finishes before deferred work starts.

export interface AfterInteractionsHandle {
  cancel(): void;
}

/** Calls `task` when the JS thread is next idle (at most `timeout` ms later). */
export function runAfterInteractions(
  task: () => void,
  timeout = 500,
): AfterInteractionsHandle {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(() => task(), {timeout});
    return {cancel: () => cancelIdleCallback(id)};
  }
  const id = setTimeout(task, 0);
  return {cancel: () => clearTimeout(id)};
}
