import {useTimestampStore} from '@/store/timestampStore';

export function useRewayatFollowAlong(rewayatId?: string): boolean {
  return useTimestampStore(
    s => !!rewayatId && s.supportedRewayatIds.has(rewayatId),
  );
}

export function useReciterFollowAlong(reciterId?: string): boolean {
  return useTimestampStore(
    s => !!reciterId && s.supportedReciterIds.has(reciterId),
  );
}

export function useFollowAlongReady(): boolean {
  return useTimestampStore(s => s.registryLoaded);
}
