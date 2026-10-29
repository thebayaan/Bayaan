// @ai-generated
/**
 * The value an `accessibilityRole="adjustable"` control moves to when
 * VoiceOver/TalkBack sends an increment or decrement action, or null when
 * the action does nothing (unknown action, or already at the bound).
 */
export function adjustableStep(
  actionName: string,
  value: number,
  min: number,
  max: number,
): number | null {
  if (actionName === 'increment' && value < max) return value + 1;
  if (actionName === 'decrement' && value > min) return value - 1;
  return null;
}
