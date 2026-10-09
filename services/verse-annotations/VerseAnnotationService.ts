import {verseAnnotationDatabaseService} from '@/services/database/VerseAnnotationDatabaseService';
import {qfSyncDatabaseService} from '@/services/sync/qfSyncDatabaseService';
import type {
  AnnotationOwnerScope,
  HighlightColor,
} from '@/types/verse-annotations';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useQfSyncStore} from '@/store/qfSyncStore';

function currentRewayah(): string {
  return useMushafSettingsStore.getState().rewayah;
}

function activeAccountId(): string | null {
  return useQfSyncStore.getState().activeAccountId;
}

function ownerScope(accountId: string | null): AnnotationOwnerScope {
  return accountId ? `qf:${accountId}` : 'guest';
}

function requestSync(accountId: string | null): void {
  const state = useQfSyncStore.getState();
  if (accountId && state.activeAccountId === accountId) state.requestSync();
}

interface AnnotationOperationToken {
  accountId: string | null;
  ownerScope: AnnotationOwnerScope;
  scopeRevision: number;
}

export interface VerseAnnotationOperation {
  readonly accountId: string | null;
  readonly ownerScope: AnnotationOwnerScope;
  isCurrent(): boolean;
  toggleBookmark(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    rewayahId?: string,
  ): Promise<boolean>;
  addBookmark(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    rewayahId?: string,
  ): ReturnType<typeof qfSyncDatabaseService.addBookmark>;
  removeBookmark(verseKey: string): Promise<void>;
  addNote(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    content: string,
    verseKeys?: string[],
    rewayahId?: string,
  ): ReturnType<typeof qfSyncDatabaseService.addNote>;
  updateNote(noteId: string, content: string): Promise<void>;
  deleteNoteById(noteId: string): Promise<void>;
  getNotesCountForVerse(verseKey: string): Promise<number>;
  upsertHighlight(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    color: HighlightColor,
    rewayahId?: string,
  ): ReturnType<
    typeof verseAnnotationDatabaseService.upsertHighlightForOwnerScope
  >;
  removeHighlight(verseKey: string): Promise<void>;
}

class VerseAnnotationService {
  private readonly activeOperations = new Map<
    AnnotationOwnerScope,
    Set<Promise<unknown>>
  >();
  private handoffGate: Promise<void> = Promise.resolve();
  private readonly handoffStartGates = new Map<
    AnnotationOwnerScope,
    Promise<void>
  >();

  async initialize(): Promise<void> {
    await verseAnnotationDatabaseService.initialize();
  }

  runInScope<T>(
    work: (operation: VerseAnnotationOperation) => Promise<T>,
  ): Promise<T> {
    const token = this.captureOperationToken();
    const operation = this.createOperation(token);
    const startGate =
      this.handoffStartGates.get(token.ownerScope) ?? this.handoffGate;
    const pending = startGate.then(() => work(operation));
    this.trackOperation(token.ownerScope, pending);
    return pending;
  }

  beginScopeHandoff(
    previousAccountId: string | null,
    barrier: Promise<unknown> = Promise.resolve(),
  ): Promise<void> {
    const scope = ownerScope(previousAccountId);
    const previousGate = this.handoffGate;
    this.handoffStartGates.set(scope, previousGate);
    const handoff = previousGate.then(async () => {
      await barrier;
      for (;;) {
        const operations = [...(this.activeOperations.get(scope) ?? [])];
        if (operations.length === 0) return;
        await Promise.allSettled(operations);
      }
    });
    const finalized = handoff.finally(() => {
      if (this.handoffStartGates.get(scope) === previousGate) {
        this.handoffStartGates.delete(scope);
      }
    });
    this.handoffGate = finalized.catch(() => undefined);
    return finalized;
  }

  async toggleBookmark(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    rewayahId?: string,
  ): Promise<boolean> {
    return this.runInScope(operation =>
      operation.toggleBookmark(verseKey, surahNumber, ayahNumber, rewayahId),
    );
  }

  async getBookmarksBySurah(surahNumber: number) {
    return verseAnnotationDatabaseService.getBookmarksBySurahInOwnerScope(
      ownerScope(activeAccountId()),
      surahNumber,
    );
  }

  async getAllBookmarks() {
    return verseAnnotationDatabaseService.getAllBookmarksInOwnerScope(
      ownerScope(activeAccountId()),
    );
  }

  async isBookmarked(verseKey: string) {
    return verseAnnotationDatabaseService.isBookmarkedInOwnerScope(
      ownerScope(activeAccountId()),
      verseKey,
    );
  }

  async addBookmark(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    rewayahId?: string,
  ) {
    return this.runInScope(operation =>
      operation.addBookmark(verseKey, surahNumber, ayahNumber, rewayahId),
    );
  }

  async removeBookmark(verseKey: string): Promise<void> {
    return this.runInScope(operation => operation.removeBookmark(verseKey));
  }

  async addNote(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    content: string,
    verseKeys?: string[],
    rewayahId?: string,
  ) {
    return this.runInScope(operation =>
      operation.addNote(
        verseKey,
        surahNumber,
        ayahNumber,
        content,
        verseKeys,
        rewayahId,
      ),
    );
  }

  async updateNote(noteId: string, content: string): Promise<void> {
    return this.runInScope(operation => operation.updateNote(noteId, content));
  }

  async deleteNoteById(noteId: string): Promise<void> {
    return this.runInScope(operation => operation.deleteNoteById(noteId));
  }

  async upsertHighlight(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    color: HighlightColor,
    rewayahId?: string,
  ) {
    return this.runInScope(operation =>
      operation.upsertHighlight(
        verseKey,
        surahNumber,
        ayahNumber,
        color,
        rewayahId,
      ),
    );
  }

  async removeHighlight(verseKey: string): Promise<void> {
    return this.runInScope(operation => operation.removeHighlight(verseKey));
  }

  async setHighlight(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    color: HighlightColor,
    rewayahId?: string,
  ) {
    return this.upsertHighlight(
      verseKey,
      surahNumber,
      ayahNumber,
      color,
      rewayahId,
    );
  }

  private captureOperationToken(): AnnotationOperationToken {
    const state = useQfSyncStore.getState();
    return {
      accountId: state.activeAccountId,
      ownerScope: ownerScope(state.activeAccountId),
      scopeRevision: state.scopeRevision,
    };
  }

  private createOperation(
    token: AnnotationOperationToken,
  ): VerseAnnotationOperation {
    return {
      accountId: token.accountId,
      ownerScope: token.ownerScope,
      isCurrent: () => {
        const state = useQfSyncStore.getState();
        return (
          state.activeAccountId === token.accountId &&
          state.scopeRevision === token.scopeRevision
        );
      },
      toggleBookmark: (verseKey, surahNumber, ayahNumber, rewayahId) =>
        this.toggleBookmarkInScope(
          token,
          verseKey,
          surahNumber,
          ayahNumber,
          rewayahId,
        ),
      addBookmark: (verseKey, surahNumber, ayahNumber, rewayahId) =>
        this.addBookmarkInScope(
          token,
          verseKey,
          surahNumber,
          ayahNumber,
          rewayahId,
        ),
      removeBookmark: verseKey => this.removeBookmarkInScope(token, verseKey),
      addNote: (
        verseKey,
        surahNumber,
        ayahNumber,
        content,
        verseKeys,
        rewayahId,
      ) =>
        this.addNoteInScope(
          token,
          verseKey,
          surahNumber,
          ayahNumber,
          content,
          verseKeys,
          rewayahId,
        ),
      updateNote: (noteId, content) =>
        this.updateNoteInScope(token, noteId, content),
      deleteNoteById: noteId => this.deleteNoteInScope(token, noteId),
      getNotesCountForVerse: verseKey =>
        verseAnnotationDatabaseService.getNotesCountForVerseInOwnerScope(
          token.ownerScope,
          verseKey,
        ),
      upsertHighlight: (verseKey, surahNumber, ayahNumber, color, rewayahId) =>
        verseAnnotationDatabaseService.upsertHighlightForOwnerScope(
          token.ownerScope,
          verseKey,
          surahNumber,
          ayahNumber,
          color,
          rewayahId ?? currentRewayah(),
        ),
      removeHighlight: verseKey =>
        verseAnnotationDatabaseService.removeHighlightInOwnerScope(
          token.ownerScope,
          verseKey,
        ),
    };
  }

  private async toggleBookmarkInScope(
    token: AnnotationOperationToken,
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    rewayahId?: string,
  ): Promise<boolean> {
    const exists =
      await verseAnnotationDatabaseService.isBookmarkedInOwnerScope(
        token.ownerScope,
        verseKey,
      );
    if (exists) {
      await this.removeBookmarkInScope(token, verseKey);
      return false;
    }
    await this.addBookmarkInScope(
      token,
      verseKey,
      surahNumber,
      ayahNumber,
      rewayahId,
    );
    return true;
  }

  private async addBookmarkInScope(
    token: AnnotationOperationToken,
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    rewayahId?: string,
  ) {
    const resolvedRewayah = rewayahId ?? currentRewayah();
    const bookmark = token.accountId
      ? await qfSyncDatabaseService.addBookmark({
          accountId: token.accountId,
          verseKey,
          surahNumber,
          ayahNumber,
          rewayahId: resolvedRewayah,
        })
      : await verseAnnotationDatabaseService.addBookmark(
          verseKey,
          surahNumber,
          ayahNumber,
          resolvedRewayah,
        );
    requestSync(token.accountId);
    return bookmark;
  }

  private async removeBookmarkInScope(
    token: AnnotationOperationToken,
    verseKey: string,
  ): Promise<void> {
    if (token.accountId) {
      await qfSyncDatabaseService.removeBookmark({
        accountId: token.accountId,
        verseKey,
      });
    } else {
      await verseAnnotationDatabaseService.removeBookmark(verseKey);
    }
    requestSync(token.accountId);
  }

  private async addNoteInScope(
    token: AnnotationOperationToken,
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    content: string,
    verseKeys?: string[],
    rewayahId?: string,
  ) {
    const resolvedRewayah = rewayahId ?? currentRewayah();
    const note = token.accountId
      ? await qfSyncDatabaseService.addNote({
          accountId: token.accountId,
          verseKey,
          surahNumber,
          ayahNumber,
          content,
          verseKeys,
          rewayahId: resolvedRewayah,
        })
      : await verseAnnotationDatabaseService.addNote(
          verseKey,
          surahNumber,
          ayahNumber,
          content,
          verseKeys,
          resolvedRewayah,
        );
    requestSync(token.accountId);
    return note;
  }

  private async updateNoteInScope(
    token: AnnotationOperationToken,
    noteId: string,
    content: string,
  ): Promise<void> {
    if (token.accountId) {
      await qfSyncDatabaseService.updateNote({
        accountId: token.accountId,
        noteId,
        content,
      });
    } else {
      await verseAnnotationDatabaseService.updateNote(noteId, content);
    }
    requestSync(token.accountId);
  }

  private async deleteNoteInScope(
    token: AnnotationOperationToken,
    noteId: string,
  ): Promise<void> {
    if (token.accountId) {
      await qfSyncDatabaseService.deleteNote({
        accountId: token.accountId,
        noteId,
      });
    } else {
      await verseAnnotationDatabaseService.deleteNoteById(noteId);
    }
    requestSync(token.accountId);
  }

  private trackOperation(
    scope: AnnotationOwnerScope,
    operation: Promise<unknown>,
  ): void {
    const operations = this.activeOperations.get(scope) ?? new Set();
    operations.add(operation);
    this.activeOperations.set(scope, operations);
    const remove = () => {
      operations.delete(operation);
      if (operations.size === 0) this.activeOperations.delete(scope);
    };
    operation.then(remove, remove);
  }

  async getNoteById(noteId: string) {
    return verseAnnotationDatabaseService.getNoteByIdInOwnerScope(
      ownerScope(activeAccountId()),
      noteId,
    );
  }

  async getNotesForVerse(verseKey: string) {
    return verseAnnotationDatabaseService.getNotesForVerseInOwnerScope(
      ownerScope(activeAccountId()),
      verseKey,
    );
  }

  async getNotesCountForVerse(verseKey: string) {
    return verseAnnotationDatabaseService.getNotesCountForVerseInOwnerScope(
      ownerScope(activeAccountId()),
      verseKey,
    );
  }

  async getAllNotes() {
    return verseAnnotationDatabaseService.getAllNotesInOwnerScope(
      ownerScope(activeAccountId()),
    );
  }

  async getNotesBySurah(surahNumber: number) {
    return verseAnnotationDatabaseService.getNotesBySurahInOwnerScope(
      ownerScope(activeAccountId()),
      surahNumber,
    );
  }

  async getHighlightsBySurah(surahNumber: number) {
    return verseAnnotationDatabaseService.getHighlightsBySurahInOwnerScope(
      ownerScope(activeAccountId()),
      surahNumber,
    );
  }

  async getAnnotationsForSurah(surahNumber: number) {
    return verseAnnotationDatabaseService.getAnnotationsForSurahInOwnerScope(
      ownerScope(activeAccountId()),
      surahNumber,
    );
  }
}

export const verseAnnotationService = new VerseAnnotationService();
