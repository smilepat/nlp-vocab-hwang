
import type { VocabItem } from './types';

export type { VocabItem };

export const GRADE_LEVELS = [
  "Elementary Grade 1-2",
  "Elementary Grade 3-4",
  "Elementary Grade 5-6",
  "Middle School",
  "High School",
  "TOEFL/IELTS"
];

export const QUESTION_TYPE_NAMES: string[] = [
  '음소(Phonics)',
  '그림/사진',
  '단어 듣고 한글 뜻 고르기',
  '철자 맞추기',
  '문맥 속 어휘의 뜻 - 한글',
  '문맥 속 어휘의 뜻 - 영어',
  '객관식 문장완성하기',
  '유의어찾기',
  '반의어찾기',
  '문맥 속 의미 추론',
  '콜로케이션(Collocation)',
];

export const INSPIRATION_TOPICS = [
  "Positive Personality (긍정적 성격)",
  "Academic Success (학업 성공)",
  "Nature & Environment (자연과 환경)",
  "Social Relations (사회적 관계)"
];

// --- Async data loading functions ---

let wordIndexCache: { w: string; l: string }[] | null = null;

export async function loadWordIndex(): Promise<{ w: string; l: string }[]> {
  if (wordIndexCache) return wordIndexCache;
  const resp = await fetch('/data/vocab-word-index.json');
  wordIndexCache = await resp.json();
  return wordIndexCache!;
}

const levelDataCache: Record<string, VocabItem[]> = {};

export async function loadVocabByLevel(level: string): Promise<VocabItem[]> {
  if (levelDataCache[level]) return levelDataCache[level];
  const indexResp = await fetch('/data/vocab-index.json');
  const index: Record<string, { file: string; count: number }> = await indexResp.json();
  const entry = index[level];
  if (!entry) return [];
  const dataResp = await fetch(`/data/${entry.file}`);
  const data: VocabItem[] = await dataResp.json();
  levelDataCache[level] = data;
  return data;
}

// Lightweight table data (no preGeneratedQuestions) for master table display
let tableDataCache: VocabItem[] | null = null;

export async function loadTableVocab(): Promise<VocabItem[]> {
  if (tableDataCache) return tableDataCache;
  const resp = await fetch('/data/vocab-table.json');
  tableDataCache = await resp.json();
  return tableDataCache!;
}
