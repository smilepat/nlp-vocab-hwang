
export interface Question {
  id: number;
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
}

export interface Worksheet {
  title: string;
  grade: string;
  topic: string;
  type: string;
  questions: Question[];
}

export interface GeneratorConfig {
  grade: string | null;
  topic: string | null;
  words: string | null;
  count: number | null;
  questionTypes?: string[];
}

export interface AnalysisResult {
  extracted: GeneratorConfig;
  isComplete: boolean;
  dataExists: boolean;
  missingFields: string[];
  feedbackMessage: string;
}

export interface VocabItem {
  word: string;
  partsOfSpeech: string;
  meaning: string;
  englishDefinition: string;
  example: string;
  synonymsAntonyms: string;
  level: string;
  cefrLevel: string;
  koreanCurriculum: string;
  questionTypes: string[];
  preGeneratedQuestions?: Record<string, string>;
}

// === Feature 3: 문제지 커스텀 헤더 ===
export interface WorksheetHeader {
  schoolName: string;
  className: string;
  teacherName: string;
  date: string;
  timeLimit: string;
  studentNameField: boolean;
}

// === Feature 4: 문제지 이력 관리 ===
export interface WorksheetHistoryItem {
  id: string;
  worksheet: Worksheet;
  header: WorksheetHeader;
  createdAt: string;
  config: GeneratorConfig;
}
