
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
