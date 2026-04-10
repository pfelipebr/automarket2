/**
 * Shared in-memory state for simulated failures.
 * When failUntil is set to a future date, the failure middleware
 * will respond with 503 to all non-admin/health routes.
 */
export const failureState: {
  failUntil: Date | null;
  reason: string;
} = {
  failUntil: null,
  reason: '',
};

export function isFailureActive(): boolean {
  if (!failureState.failUntil) return false;
  if (new Date() > failureState.failUntil) {
    failureState.failUntil = null;
    failureState.reason = '';
    return false;
  }
  return true;
}
