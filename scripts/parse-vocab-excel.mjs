import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXCEL_PATH = path.resolve(__dirname, '..', 'Copy of master_vocabulary_table.xlsx');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'public', 'data');

const QUESTION_TYPE_NAMES = [
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

function mapToGradeLevel(cefr, korCurriculum) {
  const kc = (korCurriculum || '').trim();
  if (kc.startsWith('초등3') || kc === '초등4') return 'Elementary Grade 3-4';
  if (kc === '초등5' || kc === '초등6') return 'Elementary Grade 5-6';
  if (kc.startsWith('중')) return 'Middle School';

  const c = (cefr || '').trim().toUpperCase();
  if (c === 'A1') return 'Elementary Grade 3-4';
  if (c === 'A2') return 'Elementary Grade 5-6';
  if (c === 'B1') return 'Middle School';
  if (c === 'B2') return 'High School';

  return 'Middle School';
}

// Parse the workbook
console.log('Reading Excel file...');
const workbook = XLSX.readFile(EXCEL_PATH);
console.log('Sheet names:', workbook.SheetNames);

const sheet = workbook.Sheets['master_vocab'] || workbook.Sheets[workbook.SheetNames[0]];
const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log('Total raw rows:', rawRows.length);

// Log header to verify column alignment
console.log('\nHeader row (row 0), columns 0-8:');
const headerRow = rawRows[0];
for (let i = 0; i <= 8; i++) {
  console.log(`  [${i}]: ${String(headerRow?.[i] || '').substring(0, 50)}`);
}

// Find the actual data start row (skip header rows)
// Headers have "Word" in column 1 or "선택박스" in column 0
let dataStartRow = 0;
for (let i = 0; i < Math.min(10, rawRows.length); i++) {
  const col0 = String(rawRows[i]?.[0] || '').trim();
  const col1 = String(rawRows[i]?.[1] || '').trim();
  if (col0 === '선택박스' || col1 === 'Word') {
    dataStartRow = i + 1; // data starts after this header row
    console.log(`\nFound header at row ${i}, data starts at row ${dataStartRow}`);
    break;
  }
}

// If header not found with exact match, look for the row pattern
if (dataStartRow === 0) {
  for (let i = 0; i < Math.min(10, rawRows.length); i++) {
    const col0 = String(rawRows[i]?.[0] || '').trim();
    if (col0 === '☐' || col0 === '□') {
      dataStartRow = i;
      console.log(`\nFirst data row found at row ${dataStartRow}`);
      break;
    }
  }
}

if (dataStartRow === 0) {
  // Default: skip first 3 rows as headers
  dataStartRow = 3;
  console.log(`\nUsing default: data starts at row ${dataStartRow}`);
}

const allVocab = [];

for (let i = dataStartRow; i < rawRows.length; i++) {
  const row = rawRows[i];
  const word = String(row?.[1] || '').trim();
  if (!word || word === 'Word') continue;

  const cefr = String(row?.[7] || '').trim();
  const korCurriculum = String(row?.[8] || '').trim();

  // Skip rows where CEFR is a header value
  if (cefr === 'CEFR/Grade' || korCurriculum === 'National\nCurriculum of Korea') continue;

  const questionTypes = [];
  const preGeneratedQuestions = {};

  for (let col = 10; col <= 20; col++) {
    const cellValue = String(row?.[col] || '').trim();
    if (cellValue && cellValue.length > 5) {
      const typeName = QUESTION_TYPE_NAMES[col - 10];
      if (typeName) {
        questionTypes.push(typeName);
        preGeneratedQuestions[typeName] = cellValue;
      }
    }
  }

  allVocab.push({
    word,
    partsOfSpeech: String(row?.[2] || '').trim(),
    meaning: String(row?.[3] || '').trim(),
    englishDefinition: String(row?.[4] || '').trim(),
    example: String(row?.[5] || '').trim(),
    synonymsAntonyms: String(row?.[6] || '').trim(),
    level: mapToGradeLevel(cefr, korCurriculum),
    cefrLevel: cefr,
    koreanCurriculum: korCurriculum,
    questionTypes,
    preGeneratedQuestions,
  });
}

console.log(`\nParsed ${allVocab.length} vocabulary items.`);

// Write full dataset
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

fs.writeFileSync(path.join(OUTPUT_DIR, 'vocab-all.json'), JSON.stringify(allVocab));
console.log(`Written: vocab-all.json (${(fs.statSync(path.join(OUTPUT_DIR, 'vocab-all.json')).size / 1024 / 1024).toFixed(2)} MB)`);

// Level-partitioned files
const levelGroups = {};
for (const item of allVocab) {
  if (!levelGroups[item.level]) levelGroups[item.level] = [];
  levelGroups[item.level].push(item);
}

const index = {};
for (const [level, items] of Object.entries(levelGroups)) {
  const safeFilename = `vocab-${level.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
  fs.writeFileSync(path.join(OUTPUT_DIR, safeFilename), JSON.stringify(items));
  const size = (fs.statSync(path.join(OUTPUT_DIR, safeFilename)).size / 1024).toFixed(1);
  index[level] = { file: safeFilename, count: items.length };
  console.log(`  ${level}: ${items.length} items -> ${safeFilename} (${size} KB)`);
}

// Lightweight word index for AI analysis
const wordIndex = allVocab.map(v => ({ w: v.word, l: v.level }));
fs.writeFileSync(path.join(OUTPUT_DIR, 'vocab-word-index.json'), JSON.stringify(wordIndex));
const wordIndexSize = (fs.statSync(path.join(OUTPUT_DIR, 'vocab-word-index.json')).size / 1024).toFixed(1);
console.log(`Written: vocab-word-index.json (${wordIndexSize} KB)`);

fs.writeFileSync(path.join(OUTPUT_DIR, 'vocab-index.json'), JSON.stringify(index, null, 2));
console.log('Written: vocab-index.json');

// Lightweight table data (without preGeneratedQuestions - for master table display)
const tableData = allVocab.map(({ preGeneratedQuestions, ...rest }) => rest);
fs.writeFileSync(path.join(OUTPUT_DIR, 'vocab-table.json'), JSON.stringify(tableData));
const tableSize = (fs.statSync(path.join(OUTPUT_DIR, 'vocab-table.json')).size / 1024 / 1024).toFixed(2);
console.log(`Written: vocab-table.json (${tableSize} MB) - lightweight for table display`);

console.log('\nDone!');
