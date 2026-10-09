export type QfSyncResource = 'BOOKMARK' | 'NOTE' | 'READING_SESSION';

export type QfMutationType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface QfSyncListQuery {
  mutationsSince?: string;
  resources?: QfSyncResource[];
  metadataOnly?: boolean;
  limit?: number;
  page?: number;
}

export interface QfSyncMutation<RecordShape = Record<string, unknown>> {
  type: QfMutationType;
  resource: QfSyncResource;
  record: RecordShape;
}

export interface QfSyncMutationRequest<
  RecordShape = Record<string, unknown>,
> {
  lastMutationAt: string;
  mutations: QfSyncMutation<RecordShape>[];
}
