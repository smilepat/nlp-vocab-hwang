
import { AnalysisResult } from '../types';

/**
 * 오프라인 자연어 분석기
 * Gemini AI 없이도 한국어/영어 입력에서 문제 생성에 필요한 파라미터를 추출합니다.
 * 
 * 지원 입력 예시:
 *   - "중학교 수준으로 happy, sad 단어를 넣어서 5문제 만들어줘"
 *   - "초등 3학년 environment 10문제"
 *   - "고등학교 academic success 주제로 15문항"
 *   - "fragile 3문제"
 */

// 학년 키워드 → 레벨 매핑 (구체적인 것이 먼저)
const GRADE_PATTERNS: [RegExp, string][] = [
    [/초등?\s*[1-2]|초\s*[1-2]\s*학년|elementary\s*(grade\s*)?[1-2]/i, 'Elementary Grade 1-2'],
    [/초등?\s*[3-4]|초\s*[3-4]\s*학년|elementary\s*(grade\s*)?[3-4]/i, 'Elementary Grade 3-4'],
    [/초등?\s*[5-6]|초\s*[5-6]\s*학년|elementary\s*(grade\s*)?[5-6]/i, 'Elementary Grade 5-6'],
    [/초등학교|초등|elementary/i, 'Elementary Grade 3-4'],
    [/중학교|중학|중등|중\s*[1-3]\s*학년|middle\s*school/i, 'Middle School'],
    [/고등학교|고등|고교|고\s*[1-3]\s*학년|high\s*school/i, 'High School'],
    [/toefl|ielts|토플|아이엘츠/i, 'TOEFL/IELTS'],
];

// 영어 단어 추출 시 제외할 기능어/기술 용어
const EXCLUDED_ENGLISH = new Set([
    'ai', 'pdf', 'toefl', 'ielts', 'cefr', 'ok', 'hwp',
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'all',
    'are', 'was', 'were', 'been', 'have', 'has', 'had', 'not',
    'but', 'can', 'will', 'would', 'should', 'could', 'may',
    'elementary', 'middle', 'school', 'high', 'grade',
]);

export function analyzeOffline(userInput: string): AnalysisResult {
    // --- 1. 학년 수준 추출 ---
    let grade: string | null = null;
    for (const [pattern, level] of GRADE_PATTERNS) {
        if (pattern.test(userInput)) {
            grade = level;
            break;
        }
    }

    // --- 2. 문항 수 추출 ---
    let count: number | null = null;
    const countPatterns = [
        /(\d+)\s*(?:문제|문항|개|questions?)/i,
        /(?:문제|문항)\s*(\d+)/,
    ];
    for (const pat of countPatterns) {
        const m = userInput.match(pat);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n > 0 && n <= 100) {
                count = n;
                break;
            }
        }
    }

    // --- 3. 영어 단어 추출 (잠재적 어휘 항목) ---
    const englishMatches = userInput.match(/[a-zA-Z]{2,}/g) || [];
    const vocabWords = englishMatches.filter(w =>
        !EXCLUDED_ENGLISH.has(w.toLowerCase()) && w.length >= 2
    );

    let words: string | null = null;
    if (vocabWords.length > 0) {
        words = vocabWords.join(', ');
    }

    // --- 4. 한국어 주제 추출 ---
    let topic: string | null = null;
    const topicPatterns = [
        /(?:주제|테마|토픽|관련|대한)\s*[:：]?\s*([가-힣a-zA-Z\s]{2,}?)(?:\s*(?:으로|로|에서|문제|만들|넣어|$))/,
        /([가-힣]{2,})\s*(?:주제|관련)\s*(?:으로|로)?/,
    ];
    const nonTopicWords = new Set([
        '수준', '으로', '만들어', '넣어', '줘', '해줘', '주세요',
        '문제', '단어', '학교', '학년', '중학교', '고등학교', '초등학교',
    ]);
    for (const pat of topicPatterns) {
        const m = userInput.match(pat);
        if (m) {
            const extracted = m[1].trim();
            if (!nonTopicWords.has(extracted) && extracted.length >= 2) {
                topic = extracted;
                break;
            }
        }
    }

    // --- 5. 완성도 판정 ---
    const missing: string[] = [];
    if (!grade) missing.push('grade');
    if (!words && !topic) missing.push('topic');
    if (!count) missing.push('count');

    let feedbackMessage: string;
    if (missing.length === 0) {
        feedbackMessage = '✅ 분석 완료! 모든 정보가 준비되었습니다. 아래 버튼을 눌러 문제를 제작하세요.';
    } else {
        const fieldNames: Record<string, string> = {
            grade: '학년 수준',
            topic: '주제 또는 특정 단어',
            count: '문제 수',
        };
        const missingNames = missing.map(f => fieldNames[f] || f);
        feedbackMessage = `📋 분석 결과: ${missingNames.join(', ')}이(가) 필요합니다. 아래에서 선택하거나 추가로 입력해주세요.`;
    }

    return {
        extracted: { grade, topic, words, count },
        isComplete: missing.length === 0,
        dataExists: true,  // 별도 검증 단계에서 확인
        missingFields: missing,
        feedbackMessage,
    };
}
