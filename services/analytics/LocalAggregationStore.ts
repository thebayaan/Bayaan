import {createMMKV} from 'react-native-mmkv';

const DAILY_PREFIX = 'analytics:daily:';
const KHATMAH_KEY = 'analytics:khatmah:current';
const GOAL_KEY = 'analytics:goal';

const DEFAULT_GOAL_MINUTES = 10;
const TOTAL_SURAHS = 114;

export interface DailyAggregate {
  date: string;
  listeningMs: number;
  meaningfulListens: number;
  pagesOpened: number;
  pagesRead: number;
  adhkarSessions: number;
  tasbeehCount: number;
  surahs: Record<string, number>;
  reciters: Record<string, number>;
}

export interface KhatmahProgress {
  id: string;
  startedAt: string;
  surahsCompleted: string[];
  completedAt?: string;
}

function createEmptyAggregate(date: string): DailyAggregate {
  return {
    date,
    listeningMs: 0,
    meaningfulListens: 0,
    pagesOpened: 0,
    pagesRead: 0,
    adhkarSessions: 0,
    tasbeehCount: 0,
    surahs: {},
    reciters: {},
  };
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class LocalAggregationStore {
  private readonly mmkv: ReturnType<typeof createMMKV>;

  constructor() {
    this.mmkv = createMMKV({id: 'analytics-aggregation'});
  }

  getToday(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getDailyAggregate(date: string): DailyAggregate | null {
    const raw = this.mmkv.getString(`${DAILY_PREFIX}${date}`);
    if (raw === undefined) return null;
    return JSON.parse(raw) as DailyAggregate;
  }

  private saveDailyAggregate(agg: DailyAggregate): void {
    this.mmkv.set(`${DAILY_PREFIX}${agg.date}`, JSON.stringify(agg));
  }

  private getOrCreateAggregate(date: string): DailyAggregate {
    return this.getDailyAggregate(date) ?? createEmptyAggregate(date);
  }

  addListeningTime(
    date: string,
    ms: number,
    surahId: string,
    reciterId: string,
  ): void {
    const agg = this.getOrCreateAggregate(date);
    agg.listeningMs += ms;
    agg.surahs[surahId] = (agg.surahs[surahId] ?? 0) + ms;
    agg.reciters[reciterId] = (agg.reciters[reciterId] ?? 0) + ms;
    this.saveDailyAggregate(agg);
  }

  incrementMeaningfulListens(date: string): void {
    const agg = this.getOrCreateAggregate(date);
    agg.meaningfulListens += 1;
    this.saveDailyAggregate(agg);
  }

  addPagesOpened(date: string, count: number): void {
    const agg = this.getOrCreateAggregate(date);
    agg.pagesOpened += count;
    this.saveDailyAggregate(agg);
  }

  addPagesRead(date: string, count: number): void {
    const agg = this.getOrCreateAggregate(date);
    agg.pagesRead += count;
    this.saveDailyAggregate(agg);
  }

  incrementAdhkarSessions(date: string): void {
    const agg = this.getOrCreateAggregate(date);
    agg.adhkarSessions += 1;
    this.saveDailyAggregate(agg);
  }

  addTasbeehCount(date: string, count: number): void {
    const agg = this.getOrCreateAggregate(date);
    agg.tasbeehCount += count;
    this.saveDailyAggregate(agg);
  }

  // --- Khatmah ---

  getKhatmahProgress(): KhatmahProgress | null {
    const raw = this.mmkv.getString(KHATMAH_KEY);
    if (raw === undefined) return null;
    return JSON.parse(raw) as KhatmahProgress;
  }

  private saveKhatmahProgress(progress: KhatmahProgress): void {
    this.mmkv.set(KHATMAH_KEY, JSON.stringify(progress));
  }

  startNewKhatmah(): void {
    const progress: KhatmahProgress = {
      id: generateId(),
      startedAt: new Date().toISOString(),
      surahsCompleted: [],
    };
    this.saveKhatmahProgress(progress);
  }

  markSurahCompleted(surahId: string): void {
    const progress = this.getKhatmahProgress();
    if (!progress) return;
    if (progress.surahsCompleted.includes(surahId)) return;

    progress.surahsCompleted.push(surahId);

    if (progress.surahsCompleted.length >= TOTAL_SURAHS) {
      progress.completedAt = new Date().toISOString();
    }

    this.saveKhatmahProgress(progress);
  }

  // --- Listening Goal ---

  getListeningGoal(): number {
    const raw = this.mmkv.getString(GOAL_KEY);
    if (raw === undefined) return DEFAULT_GOAL_MINUTES;
    return JSON.parse(raw) as number;
  }

  setListeningGoal(minutes: number): void {
    this.mmkv.set(GOAL_KEY, JSON.stringify(minutes));
  }
}

export const localAggregationStore = new LocalAggregationStore();
