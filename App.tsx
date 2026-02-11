
import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  Printer,
  Database,
  ArrowRight,
  User,
  Bot,
  RotateCcw,
  PlusCircle,
  Wand2,
  AlertCircle,
  X,
  Search,
  BookOpen,
  MessageSquarePlus,
  XCircle,
  FileQuestion,
  Lightbulb,
  Edit3,
  Save,
  Trash2,
  Plus,
  Table as TableIcon,
  CloudUpload
} from 'lucide-react';
import { analyzeUserPrompt, generateWorksheet } from './services/geminiService';
import { Worksheet, GeneratorConfig, AnalysisResult } from './types';
import { GRADE_LEVELS, loadTableVocab } from './constants';
import type { VocabItem } from './types';

export default function App() {
  const [userInput, setUserInput] = useState('');
  const [refinementInput, setRefinementInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Master Table States
  const [showMasterTable, setShowMasterTable] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [vocabData, setVocabData] = useState<VocabItem[]>([]);
  const [isLoadingVocab, setIsLoadingVocab] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  const bottomRef = useRef<HTMLDivElement>(null);

  // Load data from localStorage or fetch from JSON
  useEffect(() => {
    async function loadData() {
      setIsLoadingVocab(true);
      const savedData = localStorage.getItem('voca_master_data');
      if (savedData) {
        try {
          setVocabData(JSON.parse(savedData));
          setIsLoadingVocab(false);
          return;
        } catch (e) { /* fall through */ }
      }
      try {
        const data = await loadTableVocab();
        setVocabData(data);
      } catch (e) {
        console.error('Failed to load vocabulary data:', e);
        setVocabData([]);
      }
      setIsLoadingVocab(false);
    }
    loadData();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [analysis, worksheet, isAnalyzing, isGenerating, error]);

  const handleStartAnalysis = async (input: string) => {
    if (!input.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    setWorksheet(null);
    
    try {
      const result = await analyzeUserPrompt(input);
      setAnalysis(result);
      setRefinementInput('');
    } catch (err: any) {
      console.error("Analysis error:", err);
      const msg = err?.message || String(err);
      if (msg.includes('API_KEY') || msg.includes('401') || msg.includes('403') || msg.includes('key')) {
        setError("API 키가 유효하지 않습니다. .env.local 파일의 GEMINI_API_KEY를 확인해주세요.");
      } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')) {
        setError("네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.");
      } else {
        setError(`요청을 분석하는 중 오류가 발생했습니다: ${msg}`);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdatePrompt = async () => {
    if (!refinementInput.trim() || !analysis) return;
    const combinedInput = `${userInput} + 추가 요청: ${refinementInput}`;
    setUserInput(combinedInput);
    handleStartAnalysis(combinedInput);
  };

  const handleRefineQuick = (field: keyof GeneratorConfig, value: any) => {
    if (!analysis) return;
    const updatedExtracted = { ...analysis.extracted, [field]: value };
    
    const missing = [];
    if (!updatedExtracted.grade) missing.push('grade');
    if (!updatedExtracted.topic && !updatedExtracted.words) missing.push('topic');
    if (!updatedExtracted.count) missing.push('count');

    setAnalysis({
      ...analysis,
      extracted: updatedExtracted,
      isComplete: missing.length === 0 && analysis.dataExists,
      missingFields: missing,
      feedbackMessage: (missing.length === 0 && analysis.dataExists) 
        ? "모든 정보가 준비되었습니다! 아래 버튼을 눌러 문제를 제작하세요." 
        : analysis.feedbackMessage
    });
  };

  const handleTriggerGenerate = async () => {
    if (!analysis || !analysis.isComplete) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateWorksheet(analysis.extracted);
      if (result) {
        setWorksheet(result);
      } else {
        setError("조건이 맞지 않아 문제를 생성할 수 없습니다. 마스터 테이블에 해당 조건에 맞는 문제 데이터가 없습니다.");
      }
    } catch (err) {
      setError("문제 생성 도중 예상치 못한 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setUserInput('');
    setRefinementInput('');
    setAnalysis(null);
    setWorksheet(null);
    setShowAnswers(false);
    setError(null);
  };

  // Table Management Functions
  const handleAddRow = () => {
    const newRow: VocabItem = {
      word: "",
      partsOfSpeech: "",
      meaning: "",
      englishDefinition: "",
      example: "",
      synonymsAntonyms: "",
      level: "Middle School",
      cefrLevel: "",
      koreanCurriculum: "",
      questionTypes: [],
    };
    setVocabData([newRow, ...vocabData]);
  };

  const handleDeleteRow = (index: number) => {
    const updated = [...vocabData];
    updated.splice(index, 1);
    setVocabData(updated);
  };

  const handleCellChange = (index: number, field: keyof VocabItem, value: any) => {
    const updated = [...vocabData];
    if (field === 'questionTypes' && typeof value === 'string') {
      updated[index] = { ...updated[index], [field]: value.split(',').map(s => s.trim()).filter(s => s) };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setVocabData(updated);
  };

  const saveTableChanges = () => {
    try {
      localStorage.setItem('voca_master_data', JSON.stringify(vocabData));
    } catch (e) {
      console.error('localStorage quota exceeded:', e);
      alert('저장 공간이 부족합니다. 브라우저 저장소 한도를 초과했습니다.');
    }
    setIsEditMode(false);
  };

  const filteredVocab = vocabData.filter((v: VocabItem) => {
    const q = tableSearch.toLowerCase();
    return v.word.toLowerCase().includes(q) ||
      v.meaning.includes(tableSearch) ||
      v.level.toLowerCase().includes(q) ||
      (v.partsOfSpeech || '').toLowerCase().includes(q) ||
      (v.koreanCurriculum || '').includes(tableSearch);
  });

  const totalPages = Math.ceil(filteredVocab.length / PAGE_SIZE);
  const paginatedVocab = filteredVocab.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => { setCurrentPage(1); }, [tableSearch]);

  const getLevelColor = (level: string) => {
    if (level.includes("Elementary")) return "bg-blue-50 text-blue-600 border-blue-100";
    if (level.includes("Middle")) return "bg-emerald-50 text-emerald-600 border-emerald-100";
    if (level.includes("High")) return "bg-amber-50 text-amber-600 border-amber-100";
    return "bg-purple-50 text-purple-600 border-purple-100";
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans pb-20">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={handleReset}>
            <div className="bg-indigo-600 p-2 rounded-xl text-white group-hover:rotate-12 transition-transform shadow-lg shadow-indigo-100">
              <Database size={20} />
            </div>
            <h1 className="text-lg font-black tracking-tight">VocaMaster <span className="text-indigo-600">AI</span></h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowMasterTable(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 rounded-xl text-xs font-black hover:bg-indigo-50 transition-all border-2 border-indigo-100 shadow-sm"
            >
              <BookOpen size={16} />
              마스터 테이블 보기
            </button>
            <button onClick={handleReset} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 mt-12 space-y-10">
        {/* Step 1: Request Section */}
        <div className="space-y-4 no-print">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shadow-sm">
              <User size={16} />
            </div>
            <span className="text-sm font-bold text-slate-500">문제 생성 요청</span>
          </div>
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 hover:border-indigo-100 transition-all">
            <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
              <PlusCircle className="text-indigo-600" size={22} />
              어떤 문제집을 제작할까요?
            </h2>
            <div className="relative">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={isAnalyzing || isGenerating || !!analysis}
                placeholder="예: 중학교 수준으로 Fragile 단어를 넣어서 5문제 만들어줘."
                className="w-full p-0 bg-transparent text-lg font-medium focus:ring-0 outline-none resize-none h-28 placeholder:text-slate-300 transition-all leading-relaxed"
              />
              {!analysis && (
                <button
                  onClick={() => handleStartAnalysis(userInput)}
                  disabled={!userInput.trim() || isAnalyzing}
                  className="absolute bottom-0 right-0 px-8 py-4 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-30 flex items-center gap-2 font-black text-sm"
                >
                  {isAnalyzing ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />}
                  요청 분석 및 시작
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-4 p-6 bg-red-50 border border-red-200 rounded-[24px] animate-in fade-in duration-300 no-print">
            <AlertCircle className="text-red-500 shrink-0" size={24} />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-700">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="p-2 text-red-400 hover:text-red-600 transition-colors">
              <X size={18} />
            </button>
          </div>
        )}

        {/* Step 2: AI Analysis & Refinement */}
        {analysis && !worksheet && (
          <div className="space-y-6 animate-in slide-in-from-bottom-6 fade-in duration-500 no-print">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
                <Bot size={16} />
              </div>
              <span className="text-sm font-bold text-indigo-600 uppercase tracking-wider">AI 분석 및 데이터 확인</span>
            </div>

            <div className="bg-white border border-indigo-100 p-8 rounded-[40px] space-y-8 shadow-2xl shadow-indigo-50/50">
              <div className="flex items-start gap-5">
                <div className={`p-4 rounded-2xl ${analysis.dataExists ? 'bg-indigo-50 text-indigo-600' : 'bg-red-50 text-red-600'}`}>
                  {analysis.dataExists ? <Bot size={28} /> : <XCircle size={28} />}
                </div>
                <div className="flex-1">
                  <p className={`font-bold leading-relaxed text-xl ${analysis.dataExists ? 'text-slate-800' : 'text-red-700'}`}>
                    {analysis.feedbackMessage}
                  </p>
                  {!analysis.isComplete && analysis.dataExists && (
                    <p className="text-sm text-slate-400 mt-2 font-medium italic">부족한 정보를 아래 입력창에 자연어로 입력하거나 선택해주세요.</p>
                  )}
                </div>
              </div>

              {!analysis.isComplete && (
                <div className="space-y-6">
                  <div className="relative group">
                    <div className="absolute -top-3 left-6 px-2 bg-white text-[10px] font-black text-indigo-500 uppercase tracking-widest z-10 flex items-center gap-1">
                      <MessageSquarePlus size={12} /> 추가 요청 사항 입력
                    </div>
                    <textarea 
                      value={refinementInput}
                      onChange={(e) => setRefinementInput(e.target.value)}
                      placeholder="예: 10문제로 늘려줘, 초등학교 수준으로 바꿔줘 등"
                      className="w-full p-6 pt-8 bg-slate-50 border border-slate-200 rounded-3xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all h-24 resize-none text-sm font-medium shadow-inner"
                    />
                    <button 
                      onClick={handleUpdatePrompt}
                      disabled={!refinementInput.trim() || isAnalyzing}
                      className="absolute right-3 bottom-3 p-3 bg-indigo-600 text-white rounded-2xl shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-30"
                    >
                      {isAnalyzing ? <RefreshCw className="animate-spin" size={20} /> : <ArrowRight size={20} />}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {!analysis.extracted.grade && (
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-4">학년 수준 선택</label>
                        <div className="flex flex-wrap gap-2">
                          {GRADE_LEVELS.map(g => (
                            <button key={g} onClick={() => handleRefineQuick('grade', g)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {!analysis.extracted.count && (
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-4">문항 수 선택</label>
                        <div className="flex gap-2">
                          {[3, 5, 10, 15].map(c => (
                            <button key={c} onClick={() => handleRefineQuick('count', c)} className="flex-1 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                              {c}문제
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4">
                {analysis.isComplete && analysis.dataExists ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-700">
                      <CheckCircle2 size={20} className="shrink-0" />
                      <p className="text-sm font-bold leading-tight">준비 완료: {analysis.extracted.grade}, {analysis.extracted.count}문항, "{analysis.extracted.topic || analysis.extracted.words}" 주제</p>
                    </div>
                    <button
                      onClick={handleTriggerGenerate}
                      disabled={isGenerating}
                      className="w-full py-6 bg-indigo-600 text-white rounded-[24px] font-black text-xl shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
                    >
                      {isGenerating ? <RefreshCw className="animate-spin" size={24} /> : <Wand2 className="group-hover:rotate-12 transition-transform" size={24} />}
                      {isGenerating ? "문제집 생성 중..." : "문제 제작 시작하기"}
                    </button>
                  </div>
                ) : (
                  !analysis.dataExists ? (
                    <div className="p-8 border-2 border-dashed border-red-200 rounded-[32px] flex flex-col items-center justify-center text-red-500 bg-red-50/30">
                      <XCircle size={32} className="mb-3 opacity-50" />
                      <p className="font-black uppercase tracking-widest text-sm mb-2">데이터 없음</p>
                      <p className="text-xs font-bold text-center opacity-70">마스터 테이블에 해당 단어나 주제가 없습니다. <br/> "마스터 테이블 보기" 버튼을 눌러 목록을 확인해주세요.</p>
                      <button onClick={handleReset} className="mt-6 px-6 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black hover:bg-red-700 transition shadow-lg">새로 입력하기</button>
                    </div>
                  ) : (
                    <div className="p-6 border-2 border-dashed border-slate-200 rounded-[24px] flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                      <AlertCircle size={24} className="mb-2 opacity-50" />
                      <p className="text-xs font-bold uppercase tracking-widest">정보를 모두 입력하면 제작 버튼이 나타납니다</p>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Worksheet Result Area */}
        {worksheet && !isGenerating && (
          <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-700">
            {/* Header omitted for brevity as it is unchanged from original logic */}
            <div className="p-10 border-b border-slate-100 bg-white sticky top-0 z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg uppercase tracking-wider">{worksheet.grade}</span>
                  <span className="px-3 py-1 bg-slate-900 text-white text-[10px] font-black rounded-lg uppercase tracking-wider">{worksheet.questions.length}문항</span>
                </div>
                <h2 className="text-3xl font-black text-slate-900 leading-tight tracking-tight">{worksheet.title}</h2>
              </div>
              <div className="flex gap-3 shrink-0 no-print">
                <button onClick={() => setShowAnswers(!showAnswers)} className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-xs font-black transition-all border ${showAnswers ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                  <CheckCircle2 size={18} /> {showAnswers ? "정답 숨기기" : "정답 확인"}
                </button>
                <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-xs font-black hover:bg-slate-800 transition shadow-2xl">
                  <Printer size={18} /> 인쇄 / PDF 저장
                </button>
              </div>
            </div>

            <div className="p-10 md:p-16 space-y-20">
              {worksheet.questions.map((q, idx) => (
                <div key={idx} className="group relative">
                  <div className="flex items-start gap-6 mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-900 flex items-center justify-center font-black text-2xl shrink-0 border border-slate-200 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                      {idx + 1}
                    </div>
                    <div className="pt-3">
                      <p className="text-2xl font-extrabold text-slate-800 leading-tight tracking-tight">{q.question}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-0 md:ml-20">
                    {q.options?.map((opt, oIdx) => (
                      <div key={oIdx} className="p-6 border border-slate-100 rounded-3xl text-base font-bold text-slate-600 flex items-center gap-4 bg-slate-50/30 hover:bg-white hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50 transition-all">
                        <span className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-[11px] font-black flex items-center justify-center text-slate-400">
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        {opt}
                      </div>
                    ))}
                  </div>
                  {showAnswers && (
                    <div className="mt-8 ml-0 md:ml-20 p-8 bg-emerald-50/50 rounded-[40px] border border-emerald-100 animate-in zoom-in-95 duration-300 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-6 opacity-5"><CheckCircle2 size={80} className="text-emerald-900" /></div>
                      <div className="flex items-center gap-3 text-emerald-800 font-black mb-4">
                        <CheckCircle2 size={22} />
                        <span className="text-xl">정답: <span className="underline underline-offset-4 decoration-2">{q.answer}</span></span>
                      </div>
                      <div className="h-px bg-emerald-200/50 w-full mb-5"></div>
                      <div className="space-y-1">
                        <span className="text-emerald-900 font-black uppercase text-[10px] tracking-[0.2em] block">해설</span>
                        <p className="text-sm text-emerald-900/80 font-bold leading-relaxed">{q.explanation}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-10 bg-slate-50 border-t border-slate-100 text-center flex flex-col items-center gap-2">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em]">VocaMaster AI Worksheet Engine</p>
              <p className="text-[9px] text-slate-300 font-bold">마스터 단어 데이터 기반 제작</p>
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-10" />
      </main>

      {/* Master Table Modal with Edit Functionality */}
      {showMasterTable && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-8">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowMasterTable(false)} />
          <div className="relative bg-white w-full max-w-7xl h-full max-h-[92vh] rounded-[48px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
                  <Database size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    데이터베이스 <span className="text-slate-300 text-lg font-medium">|</span> 
                    <span className={isEditMode ? "text-indigo-600" : "text-slate-400"}>
                      {isEditMode ? "수정 모드 (Spreadsheet)" : "보기 모드"}
                    </span>
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">전체 {vocabData.length}개 유닛</p>
                    <div className="w-1 h-1 rounded-full bg-slate-200" />
                    <p className="text-xs text-indigo-600 font-bold">검색 결과: {filteredVocab.length}개</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isEditMode ? (
                  <>
                    <button 
                      onClick={handleAddRow}
                      className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-black hover:bg-slate-200 transition-all border border-slate-200"
                    >
                      <Plus size={16} /> 행 추가
                    </button>
                    <button 
                      onClick={saveTableChanges}
                      className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                      <Save size={16} /> 저장 및 동기화
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setIsEditMode(true)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white text-indigo-600 border-2 border-indigo-600 rounded-xl text-xs font-black hover:bg-indigo-50 transition-all"
                  >
                    <Edit3 size={16} /> 테이블 수정하기
                  </button>
                )}
                <button onClick={() => {setShowMasterTable(false); setIsEditMode(false);}} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-900 transition-all"><X size={24} /></button>
              </div>
            </div>
            
            {/* Search Section */}
            <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="단어, 뜻, 유형, 학년으로 검색..." 
                  value={tableSearch} 
                  onChange={(e) => setTableSearch(e.target.value)} 
                  className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-sm shadow-sm" 
                />
              </div>
              {isEditMode && (
                <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 rounded-2xl text-indigo-700 text-xs font-bold border border-indigo-100">
                  <CloudUpload size={16} />
                  Google Sheets 형식으로 자동 준비됨
                </div>
              )}
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto px-8 pb-8">
              <div className="min-w-[1200px]">
                <table className="w-full border-separate border-spacing-y-2">
                  <thead className="sticky top-0 bg-white z-20 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)]">
                    <tr className="text-left">
                      {isEditMode && <th className="w-12 bg-white"></th>}
                      <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest bg-white">Vocabulary & Meaning</th>
                      <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest bg-white text-center">Level</th>
                      <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest bg-white">Question Types</th>
                      <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest bg-white">Example & Sample Question</th>
                    </tr>
                  </thead>
                  <tbody className="pt-2">
                    {paginatedVocab.map((v, i) => (
                      <tr key={i} className="group transition-all duration-300">
                        {/* Action Column for Edit Mode */}
                        {isEditMode && (
                          <td className="px-2 text-center align-middle">
                            <button 
                              onClick={() => handleDeleteRow(vocabData.indexOf(v))}
                              className="p-2 text-red-300 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        )}

                        {/* Word & Meaning */}
                        <td className={`px-6 py-4 border-y border-l border-slate-100 rounded-l-[24px] bg-white ${isEditMode ? 'border-indigo-200' : 'group-hover:border-indigo-100'}`}>
                          {isEditMode ? (
                            <div className="space-y-2">
                              <input 
                                value={v.word} 
                                onChange={(e) => handleCellChange(vocabData.indexOf(v), 'word', e.target.value)}
                                placeholder="Word"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg font-black text-indigo-600 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <input 
                                value={v.meaning} 
                                onChange={(e) => handleCellChange(vocabData.indexOf(v), 'meaning', e.target.value)}
                                placeholder="Meaning"
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-500 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className="text-xl font-black text-indigo-600 block">{v.word}</span>
                              {v.partsOfSpeech && <span className="text-[10px] font-bold text-slate-400 uppercase">{v.partsOfSpeech}</span>}
                              <span className="text-sm font-bold text-slate-500 block">{v.meaning}</span>
                              {v.englishDefinition && <span className="text-xs text-slate-400 italic block">{v.englishDefinition}</span>}
                            </div>
                          )}
                        </td>

                        {/* Level Selection */}
                        <td className={`px-6 py-4 border-y border-slate-100 bg-white text-center ${isEditMode ? 'border-indigo-200' : 'group-hover:border-indigo-100'}`}>
                          {isEditMode ? (
                            <select 
                              value={v.level} 
                              onChange={(e) => handleCellChange(vocabData.indexOf(v), 'level', e.target.value)}
                              className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              {GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                          ) : (
                            <span className={`px-3 py-1.5 border rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${getLevelColor(v.level)}`}>
                              {v.level}
                            </span>
                          )}
                        </td>

                        {/* Question Types */}
                        <td className={`px-6 py-4 border-y border-slate-100 bg-white ${isEditMode ? 'border-indigo-200' : 'group-hover:border-indigo-100'}`}>
                          {isEditMode ? (
                            <textarea 
                              value={v.questionTypes.join(', ')} 
                              onChange={(e) => handleCellChange(vocabData.indexOf(v), 'questionTypes', e.target.value)}
                              placeholder="Types (comma separated)"
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold h-20 resize-none outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {v.questionTypes.map((type, idx) => (
                                <span key={idx} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black border border-slate-200">
                                  <FileQuestion size={12} className="text-slate-400" />
                                  {type}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Sentences & Samples */}
                        <td className={`px-6 py-4 border-y border-r border-slate-100 rounded-r-[24px] bg-white ${isEditMode ? 'border-indigo-200' : 'group-hover:border-indigo-100'}`}>
                          {isEditMode ? (
                            <div className="space-y-3 max-w-lg">
                              <div className="space-y-1">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Example Sentence</span>
                                <textarea
                                  value={v.example}
                                  onChange={(e) => handleCellChange(vocabData.indexOf(v), 'example', e.target.value)}
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium italic resize-none h-16 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              {v.questionTypes && v.questionTypes.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                                    Pre-generated Questions ({v.questionTypes.length} types)
                                  </span>
                                  <div className="text-[10px] text-slate-500 font-medium">
                                    {v.questionTypes.join(', ')}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-4 max-w-lg">
                              <div className="flex items-start gap-3">
                                <Lightbulb size={16} className="text-amber-500 shrink-0 mt-1" />
                                <p className="text-xs text-slate-500 font-medium italic leading-relaxed">
                                  <span className="text-slate-900 font-bold not-italic block mb-1 uppercase tracking-tighter text-[10px]">Usage Example</span>
                                  "{v.example}"
                                </p>
                              </div>
                              {v.synonymsAntonyms && (
                                <p className="text-[10px] text-slate-400 font-bold">
                                  <span className="text-slate-500">Synonyms/Antonyms:</span> {v.synonymsAntonyms}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredVocab.length === 0 && (
                      <tr>
                        <td colSpan={isEditMode ? 5 : 4} className="py-32 text-center">
                          <div className="flex flex-col items-center gap-4 opacity-40">
                            <div className="p-6 bg-slate-100 rounded-full">
                              <Search size={48} className="text-slate-400" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-black text-slate-900 tracking-tight text-xl">데이터가 비어있습니다</p>
                              <p className="text-sm text-slate-400 font-medium">단어를 직접 추가하거나 검색 조건을 변경해보세요.</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Pagination */}
            <div className="px-8 py-4 flex items-center justify-between border-t border-slate-100 bg-white shrink-0">
              <p className="text-xs text-slate-400 font-bold">
                {filteredVocab.length}개 중 {filteredVocab.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0}-{Math.min(currentPage * PAGE_SIZE, filteredVocab.length)}개 표시
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold disabled:opacity-30 hover:bg-slate-50 transition"
                >
                  이전
                </button>
                <span className="text-xs font-bold text-slate-500">
                  {currentPage} / {totalPages || 1}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold disabled:opacity-30 hover:bg-slate-50 transition"
                >
                  다음
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between px-10 shrink-0">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">Smart AI Dataset Engine v2.5</p>
              {isEditMode && (
                <div className="flex items-center gap-4">
                   <p className="text-[10px] text-indigo-400 font-bold">변경사항은 브라우저에 자동 저장됩니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .shake { animation: shake 0.4s ease-in-out; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          main { margin-top: 0 !important; width: 100% !important; max-width: 100% !important; padding: 0 !important; }
          nav { display: none !important; }
          .rounded-\\[40px\\], .rounded-\\[32px\\] { border-radius: 0 !important; border: none !important; box-shadow: none !important; }
        }
        .overflow-auto::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .overflow-auto::-webkit-scrollbar-track {
          background: transparent;
        }
        .overflow-auto::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .overflow-auto::-webkit-scrollbar-thumb:hover {
          background: #6366f1;
        }
        input::placeholder, textarea::placeholder {
          color: #cbd5e1;
        }
      `}} />
    </div>
  );
}
