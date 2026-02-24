
import { GoogleGenAI, Type } from "@google/genai";
import { Worksheet, Question, GeneratorConfig, AnalysisResult } from "../types";
import { GRADE_LEVELS, loadWordIndex, loadVocabByLevel } from "../constants";
import type { VocabItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

function toLevelKorean(level: string): string {
  const map: Record<string, string> = {
    "Elementary Grade 1-2": "초등 1-2학년",
    "Elementary Grade 3-4": "초등 3-4학년",
    "Elementary Grade 5-6": "초등 5-6학년",
    "Middle School": "중학교",
    "High School": "고등학교",
    "TOEFL/IELTS": "TOEFL/IELTS"
  };
  return map[level] || level;
}

// === 단어 유효성 검증 (AI/오프라인 공용) ===
export async function validateWordsInData(result: AnalysisResult): Promise<AnalysisResult> {
  if (!result.extracted.words) return result;

  const wordIndex = await loadWordIndex();
  const requestedWords = result.extracted.words.split(',').map(w => w.trim().toLowerCase()).filter(w => w);

  // Build word → levels map
  const wordLevelMap = new Map<string, string[]>();
  for (const entry of wordIndex) {
    const w = entry.w.toLowerCase();
    if (!wordLevelMap.has(w)) wordLevelMap.set(w, []);
    if (!wordLevelMap.get(w)!.includes(entry.l)) wordLevelMap.get(w)!.push(entry.l);
  }

  const foundWords = requestedWords.filter(w => wordLevelMap.has(w));

  if (foundWords.length === 0) {
    result.dataExists = false;
    result.isComplete = false;
    result.feedbackMessage = `해당 단어(${result.extracted.words})가 마스터 데이터에 없습니다. 다른 단어를 입력해주세요.`;
  } else if (result.extracted.grade) {
    // Check if words match the requested grade level
    const mismatched: { word: string; levels: string[] }[] = [];
    for (const w of foundWords) {
      const levels = wordLevelMap.get(w) || [];
      if (!levels.includes(result.extracted.grade)) {
        mismatched.push({ word: w, levels });
      }
    }

    if (mismatched.length > 0 && mismatched.length === foundWords.length) {
      result.dataExists = false;
      result.isComplete = false;
      const details = mismatched.map(m =>
        `'${m.word}'은(는) ${m.levels.map(toLevelKorean).join(', ')} 레벨의 단어입니다.`
      ).join(' ');
      result.feedbackMessage = `${details} ${toLevelKorean(result.extracted.grade)} 레벨에 해당하지 않습니다. 다른 단어를 입력하거나 레벨을 변경해주세요.`;
    } else {
      result.dataExists = true;
    }
  } else {
    result.dataExists = true;
  }

  return result;
}

// === AI 기반 사용자 입력 분석 ===
export const analyzeUserPrompt = async (userInput: string): Promise<AnalysisResult> => {
  // Step 1: AI extracts parameters only (no word list sent)
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `사용자의 영단어 문제지 제작 요청을 분석하세요: "${userInput}"

    허용되는 학년 수준: [${GRADE_LEVELS.join(', ')}]

    분석 규칙:
    1. 학년 수준(grade), 주제(topic), 특정 단어(words), 문제 수(count)를 추출하세요.
    2. 학년은 반드시 허용되는 학년 수준 목록에서 선택하세요. 사용자가 "중학교"라고 하면 "Middle School", "초등 3학년"이면 "Elementary Grade 3-4" 등으로 매핑하세요.
    3. 정보 누락 확인:
       - 학년, 주제/단어, 문제 수 중 하나라도 없으면 isComplete를 false로 설정하세요.
       - 누락된 항목에 대해 피드백을 생성하세요.
    4. dataExists는 일단 true로 설정하세요 (서버 측에서 검증합니다).
    5. 모든 정보가 있으면 isComplete를 true로 설정하세요.

    결과는 반드시 JSON으로만 반환하세요.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          extracted: {
            type: Type.OBJECT,
            properties: {
              grade: { type: Type.STRING, nullable: true },
              topic: { type: Type.STRING, nullable: true },
              words: { type: Type.STRING, nullable: true },
              count: { type: Type.INTEGER, nullable: true }
            }
          },
          isComplete: { type: Type.BOOLEAN },
          dataExists: { type: Type.BOOLEAN },
          missingFields: { type: Type.ARRAY, items: { type: Type.STRING } },
          feedbackMessage: { type: Type.STRING }
        },
        required: ["extracted", "isComplete", "dataExists", "missingFields", "feedbackMessage"]
      }
    }
  });

  const result = JSON.parse(response.text || '{}') as AnalysisResult;

  // Step 2: 단어 유효성 검증
  return validateWordsInData(result);
};

// --- Pre-generated question parser ---

function parsePreGeneratedQuestion(
  raw: string,
  id: number,
  word: string,
  meaning: string,
  questionType: string
): Question {
  // Extract answer letter (e.g., "Answer: C", "Answer C", "Answer: B")
  const answerMatch = raw.match(/Answer[:\s]*([A-D])/i);
  const answerLetter = answerMatch ? answerMatch[1].toUpperCase() : '';

  // Remove answer line from text
  let text = raw.replace(/\n?\s*Answer[:\s]*[A-D]\s*$/i, '').trim();

  // Remove "Q:" prefix
  text = text.replace(/^Q:\s*/i, '').trim();

  // Try to extract options (multi-line: A. text / A) text on separate lines)
  const options: string[] = [];
  let questionText = text;

  const optRegex = /(?:^|\n)\s*([A-D])[.)]\s*(.+)/g;
  const optEntries: { letter: string; text: string; startIdx: number }[] = [];
  let m;
  while ((m = optRegex.exec(text)) !== null) {
    optEntries.push({ letter: m[1], text: m[2].trim(), startIdx: m.index });
  }

  if (optEntries.length >= 2) {
    questionText = text.substring(0, optEntries[0].startIdx).trim();
    for (const entry of optEntries) {
      options.push(entry.text);
    }
  } else {
    // Fallback: single-line format "A) a  B) an  C) the  D) some"
    const singleLine = text.match(/A[.)]\s*.+?(?:\s{2,}|\s+)B[.)]\s*.+/);
    if (singleLine) {
      const line = singleLine[0];
      questionText = text.substring(0, text.indexOf(line)).trim();
      const parts = line.split(/\s+(?=[B-D][.)]\s)/);
      for (const part of parts) {
        options.push(part.replace(/^[A-D][.)]\s*/, '').trim());
      }
    }
  }

  // Determine answer text from letter
  const answerIndex = answerLetter ? answerLetter.charCodeAt(0) - 65 : -1;
  const answerText = answerIndex >= 0 && answerIndex < options.length
    ? options[answerIndex]
    : answerLetter;

  const explanation = `'${word}'의 뜻은 '${meaning}'입니다. (문제 유형: ${questionType})`;

  return {
    id,
    question: questionText,
    options: options.length > 0 ? options : undefined,
    answer: answerText,
    explanation
  };
}

// --- Worksheet generation: pulls from master table only, NO LLM ---

export const generateWorksheet = async (config: GeneratorConfig): Promise<Worksheet | null> => {
  // Load vocab with preGeneratedQuestions for the relevant level
  const levelVocab = config.grade ? await loadVocabByLevel(config.grade) : [];

  // Filter by words or topic
  let relevantVocab: VocabItem[] = levelVocab;

  if (config.words) {
    const requestedWords = config.words.split(',').map(w => w.trim().toLowerCase());
    relevantVocab = levelVocab.filter(v =>
      requestedWords.some(rw => v.word.toLowerCase().includes(rw) || rw.includes(v.word.toLowerCase()))
    );
    // If specific words not found in that level, search all levels
    if (relevantVocab.length === 0) {
      const allIndex = await loadWordIndex();
      const wordLevels = new Set(
        allIndex
          .filter(w => requestedWords.some(rw => w.w.toLowerCase() === rw))
          .map(w => w.l)
      );
      for (const level of wordLevels) {
        const data = await loadVocabByLevel(level);
        relevantVocab.push(...data.filter(v =>
          requestedWords.some(rw => v.word.toLowerCase() === rw)
        ));
      }
    }
  } else if (config.topic) {
    // Filter by topic keyword matching against word data
    const topicLower = config.topic.toLowerCase();
    const topicKeywords = topicLower.split(/[\s,]+/).filter(k => k.length > 1);
    relevantVocab = levelVocab.filter(v => {
      const searchable = `${v.word} ${v.meaning} ${v.englishDefinition} ${v.example} ${v.synonymsAntonyms}`.toLowerCase();
      return topicKeywords.some(kw => searchable.includes(kw));
    });
  }

  // Keep only items that have preGeneratedQuestions
  const vocabWithQuestions = relevantVocab.filter(v =>
    v.preGeneratedQuestions && Object.keys(v.preGeneratedQuestions).length > 0
  );

  if (vocabWithQuestions.length === 0) {
    return null;
  }

  const count = config.count || 10;

  // Collect all available questions from matching vocab
  const allQuestions: { word: string; type: string; raw: string; meaning: string }[] = [];
  for (const v of vocabWithQuestions) {
    for (const [qType, qText] of Object.entries(v.preGeneratedQuestions!)) {
      allQuestions.push({ word: v.word, type: qType, raw: qText, meaning: v.meaning });
    }
  }

  if (allQuestions.length === 0) {
    return null;
  }

  // === Feature 2: 문제 유형 필터링 ===
  let questionsPool = allQuestions;
  if (config.questionTypes && config.questionTypes.length > 0) {
    questionsPool = allQuestions.filter(q => config.questionTypes!.includes(q.type));
  }

  if (questionsPool.length === 0) {
    return null;
  }

  // Shuffle for variety
  const shuffled = [...questionsPool].sort(() => Math.random() - 0.5);

  // Select questions, diversifying by word (max 2 per word initially)
  const selectedByWord: Record<string, number> = {};
  const selected: typeof questionsPool = [];

  for (const q of shuffled) {
    if (selected.length >= count) break;
    const wordCount = selectedByWord[q.word] || 0;
    if (wordCount < 2) {
      selected.push(q);
      selectedByWord[q.word] = wordCount + 1;
    }
  }

  // If still not enough, allow more per word
  if (selected.length < count) {
    for (const q of shuffled) {
      if (selected.length >= count) break;
      if (!selected.includes(q)) {
        selected.push(q);
      }
    }
  }

  // Parse each raw question into structured Question format
  const questions: Question[] = selected.map((q, i) =>
    parsePreGeneratedQuestion(q.raw, i + 1, q.word, q.meaning, q.type)
  );

  return {
    title: `${config.grade || ''} - ${config.topic || config.words || '영단어'} 문제지`,
    grade: config.grade || '',
    topic: config.topic || config.words || '',
    type: 'multiple-choice',
    questions
  };
};
