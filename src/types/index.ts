// ===== 章节与知识点 =====
export interface KnowledgePoint {
  id: string;
  name: string;
  chapterId: string;
  originalText: string;
  completedCount: number;
  totalCount: number;
  questions?: Question[];
}

export interface Chapter {
  id: string;
  name: string;
  materialId: string;
  knowledgePoints: KnowledgePoint[];
  completedCount: number;
  totalCount: number;
}

export interface Material {
  id: string;
  title: string;
  chapters: Chapter[];
  createdAt: string;
}

// ===== 题目 =====
export interface ClozeBlank {
  id: string;
  answer: string;    // 正确答案
  userAnswer?: string;
  index: number;     // 在文本中的占位索引
}

export interface ClozeQuestion {
  id: string;
  type: 'cloze';
  knowledgePointId: string;
  originalText: string;    // 完整原句
  displayText: string;     // 带 {{blank_0}} 占位符的文字
  blanks: ClozeBlank[];
  isCorrect?: boolean;
  isStarred: boolean;
}

export interface ScoringPoint {
  point: string;
  hit: boolean;
}

export interface ShortAnswerQuestion {
  id: string;
  type: 'short_answer';
  knowledgePointId: string;
  question: string;
  referenceAnswer: string;
  userAnswer?: string;
  score?: number;
  scoringPoints?: ScoringPoint[];
  isCorrect?: boolean;
  isStarred: boolean;
}

export type Question = ClozeQuestion | ShortAnswerQuestion;

// ===== 错题记录 =====
export interface ErrorRecord {
  id: string;
  questionId: string;
  question: Question;
  chapterName: string;
  knowledgePointName: string;
  errorCount: number;
  lastErrorAt: string;
  resolved: boolean;
}

// ===== 聊天 =====
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ===== 应用状态 =====
export interface AppState {
  currentMaterial: Material | null;
  currentChapterId: string | null;
  currentKnowledgePointId: string | null;
  currentQuestionIndex: number;
  questions: Question[];
  errorRecords: ErrorRecord[];
}
