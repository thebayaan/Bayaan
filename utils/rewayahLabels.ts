// Compatibility re-exports. All rewayah identity logic lives in
// services/rewayah/RewayahIdentity.ts; prefer importing from there directly.
// This file exists so existing call sites continue to resolve without a
// sweeping import-path change.

export {
  getShortLabel as getRewayahShortLabel,
  resolveRewayahFromName as mapRewayatNameToRewayahId,
} from '@/services/rewayah/RewayahIdentity';
