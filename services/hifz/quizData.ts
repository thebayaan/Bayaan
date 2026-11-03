import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {PLAN_DATA} from './progressLoader';
import type {QuizData} from './quiz';

export const QUIZ_DATA: QuizData = {
  ayahCount: PLAN_DATA.ayahCount,
  pagesOfSurah: PLAN_DATA.pagesOfSurah,
  keysOfPage: page => mushafVerseMapService.getOrderedVerseKeysForPage(page),
};
