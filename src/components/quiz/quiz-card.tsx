'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dices, Loader2, RotateCcw, Send, Star, Copy, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClozeQuestionCard } from './cloze-question';
import { QuizToolbar } from './quiz-toolbar';
import { apiClient } from '@/lib/api-client';
import { useSWRConfig } from 'swr';
import { Textarea } from '@/components/ui/textarea';
import { useAiSettings } from '@/store/ai-settings';
import { copyText } from '@/lib/copy';

type PracticeMode = 'sequential' | 'random';

type QuizQuestion = {
  id: string;
  type: string;
  blanksData?: string | null;
  usedBlanksHistory?: string | null;
  isStarred?: boolean;
  qaQuestion?: string | null;
  qaReferenceAnswer?: string | null;
};

type KnowledgePointLike = {
  name?: string;
  originalText?: string;
};

interface QuizCardProps {
  questions: QuizQuestion[];
  currentIndex: number;
  knowledgePointRaw: KnowledgePointLike;
  onIndexChange: (index: number) => void;
  onWrongAnswerSubmit: (wrongText: string) => void;
  onCorrectAnswerSubmit?: () => void;
  onPrevChapter?: () => void;
  onNextChapter?: () => void;
  onCompleteAll?: () => void;
  hasPrevChapter?: boolean;
  hasNextChapter?: boolean;
}

type GradeResult = {
  score: number;
  feedback: string;
  advice: string;
};

const getRandomIndex = (total: number, current: number): number => {
  if (total <= 1) return 0;
  let next = current;
  while (next === current) {
    next = Math.floor(Math.random() * total);
  }
  return next;
};

const isOpenEndedType = (type: string) => ['short_answer', 'thinking', 'application'].includes(type.toLowerCase());

export function QuizCard({
  questions,
  currentIndex,
  knowledgePointRaw,
  onIndexChange,
  onWrongAnswerSubmit,
  onCorrectAnswerSubmit,
  onPrevChapter,
  onNextChapter,
  onCompleteAll,
  hasPrevChapter = false,
  hasNextChapter = false,
}: QuizCardProps) {
  const [showResult, setShowResult] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('sequential');
  const [answerText, setAnswerText] = useState('');
  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const { mutate } = useSWRConfig();
  const { settings } = useAiSettings();

  const current = questions[currentIndex];
  const currentType = (current?.type || 'cloze').toLowerCase();

  useEffect(() => {
    setIsStarred(Boolean(current?.isStarred));
    setShowResult(false);
    setAnswerText('');
    setGradeResult(null);
  }, [current?.id, current?.isStarred]);

  const parsedBlanks = useMemo(() => {
    if (!current?.blanksData) return [];
    try {
      return JSON.parse(current.blanksData) as Array<{ id: string; answer: string; index: number }>;
    } catch {
      return [];
    }
  }, [current?.blanksData]);

  if (!current) return null;

  const handleSubmit = async () => {
    if (currentType === 'cloze' || currentType === 'choice') {
      setShowResult(true);
      return;
    }

    if (!answerText.trim()) {
      alert('请先输入答案。');
      return;
    }

    setGrading(true);
    try {
      const response = await apiClient.fetch('/api/ai/grade-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionType: currentType,
          question: current.qaQuestion || currentType,
          referenceAnswer: current.qaReferenceAnswer || '',
          userAnswer: answerText,
          maxScore: 10,
          additionalPrompt: settings.extraPrompt || '',
        }),
      });
      const data = (await response.json()) as GradeResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'AI 评分失败');
      }
      setGradeResult(data);
      setShowResult(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 评分失败';
      alert(message);
    } finally {
      setGrading(false);
    }
  };

  const handleGenerateByType = async (targetType: 'cloze' | 'short_answer' | 'thinking' | 'application' | 'choice') => {
    if (rerolling || !knowledgePointRaw.originalText) return;
    setRerolling(true);
    setShowResult(false);
    setGradeResult(null);

    try {
      if (targetType === 'cloze') {
        const history = current.usedBlanksHistory ? (JSON.parse(current.usedBlanksHistory) as string[]) : [];
        const aiRes = await apiClient.fetch('/api/ai/generate-cloze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalText: knowledgePointRaw.originalText,
            usedBlanksHistory: history,
            questionType: targetType,
            additionalPrompt: settings.extraPrompt || '',
          }),
        });
        if (!aiRes.ok) throw new Error('generate failed');

        const aiData = (await aiRes.json()) as { answers: string[]; sentence: string };
        const newAnswers = aiData.answers || [];
        const blanksData = newAnswers.map((ans, i) => ({ id: `b${i}`, answer: ans, index: i }));
        const usedBlanksHistory = [...history, ...newAnswers];

        await fetch(`/api/questions/${current.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'cloze',
            blanksData,
            usedBlanksHistory,
            displayText: aiData.sentence,
            qaQuestion: null,
            qaReferenceAnswer: null,
          }),
        });
      } else {
        const qaRes = await apiClient.fetch('/api/ai/generate-qa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalText: knowledgePointRaw.originalText,
            questionType: targetType,
            additionalPrompt: settings.extraPrompt || '',
          }),
        });
        if (!qaRes.ok) throw new Error('generate failed');

        const qaData = (await qaRes.json()) as {
          question: string;
          referenceAnswer: string;
          options?: string[];
        };

        const mergedQuestion = targetType === 'choice' && qaData.options?.length
          ? `${qaData.question}\n${qaData.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n')}`
          : qaData.question;

        await fetch(`/api/questions/${current.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: targetType,
            qaQuestion: mergedQuestion,
            qaReferenceAnswer: qaData.referenceAnswer,
            displayText: null,
            blanksData: null,
            usedBlanksHistory: null,
          }),
        });
      }

      await mutate('/api/materials');
    } catch {
      alert('重新生成失败，请检查网络或 AI 配置');
    } finally {
      setRerolling(false);
    }
  };

  const handleReroll = async () => {
    await handleGenerateByType(currentType === 'cloze' ? 'cloze' : (currentType as 'short_answer' | 'thinking' | 'application' | 'choice'));
  };

  const handleSwitchType = async () => {
    const nextType: 'cloze' | 'short_answer' = currentType === 'cloze' ? 'short_answer' : 'cloze';
    await handleGenerateByType(nextType);
  };

  const handleReset = () => {
    setShowResult(false);
    setGradeResult(null);
  };

  const handleToggleStar = async () => {
    const nextStarred = !isStarred;
    setIsStarred(nextStarred);
    try {
      await fetch(`/api/questions/${current.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStarred: nextStarred }),
      });
      await mutate('/api/materials');
      await mutate('/api/favorites');
    } catch {
      setIsStarred(!nextStarred);
    }
  };

  const handleCopyCurrentQuestion = async () => {
    const prompt = `请分析这道题与作答情况，给出评分建议、错误点和改进建议。\n题型：${currentType}\n题目：${current.qaQuestion || current.displayText || knowledgePointRaw.name || ''}\n用户答案：${answerText || '（当前未录入）'}\n参考答案：${current.qaReferenceAnswer || '（无）'}`;
    const copied = await copyText(prompt);
    if (copied) {
      alert('已复制本题内容与外部分析提示词。');
      return;
    }
    alert('当前环境不支持自动复制，请长按手动复制。');
  };

  const handleNext = () => {
    setShowResult(false);
    setGradeResult(null);
    if (practiceMode === 'random') {
      onIndexChange(getRandomIndex(questions.length, currentIndex));
      return;
    }
    if (currentIndex >= questions.length - 1) {
      if (hasNextChapter) {
        onNextChapter?.();
      } else {
        onCompleteAll?.();
      }
      return;
    }
    onIndexChange(Math.min(currentIndex + 1, questions.length - 1));
  };

  const handlePrev = () => {
    setShowResult(false);
    setGradeResult(null);
    if (practiceMode === 'random') {
      onIndexChange(getRandomIndex(questions.length, currentIndex));
      return;
    }
    if (currentIndex <= 0 && hasPrevChapter) {
      onPrevChapter?.();
      return;
    }
    onIndexChange(Math.max(currentIndex - 1, 0));
  };

  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-sm text-muted-foreground">{knowledgePointRaw?.name || '未命名知识点'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={practiceMode === 'sequential' ? 'default' : 'outline'} size="sm" onClick={() => setPracticeMode('sequential')}>
            顺序刷题
          </Button>
          <Button variant={practiceMode === 'random' ? 'default' : 'outline'} size="sm" onClick={() => setPracticeMode('random')}>
            随机刷题
          </Button>
        </div>
      </div>

      <QuizToolbar
        currentIndex={currentIndex}
        total={questions.length}
        onPrev={handlePrev}
        onNext={handleNext}
        onPrevChapter={onPrevChapter}
        onNextChapter={onNextChapter}
        disablePrev={practiceMode === 'sequential' && currentIndex === 0}
        disablePrevChapter={!hasPrevChapter || practiceMode === 'random'}
        disableNextChapter={!hasNextChapter || practiceMode === 'random'}
      />

      <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-xl shadow-black/5">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs text-muted-foreground">#{currentIndex + 1}</Badge>
              <Badge className="text-xs bg-violet-500/15 text-violet-400 border border-violet-500/20">
                {currentType === 'cloze'
                  ? '填空题'
                  : currentType === 'choice'
                    ? '选择题'
                    : currentType === 'thinking'
                      ? '思考题'
                      : currentType === 'application'
                        ? '应用题'
                        : '简答题'}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleToggleStar} title={isStarred ? '取消收藏' : '收藏'}>
              <Star className={cn('h-4 w-4 transition-colors', isStarred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {rerolling ? (
            <div className="flex flex-col items-center justify-center p-10 gap-4 min-h-[200px]">
              <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
              <p className="text-violet-400 animate-pulse">AI 正在重生成题目...</p>
            </div>
          ) : currentType === 'cloze' ? (
            <ClozeQuestionCard
              key={current.id}
              question={{
                ...current,
                blanks: parsedBlanks,
                originalText: knowledgePointRaw.originalText,
              }}
              onWrongAnswerSubmit={onWrongAnswerSubmit}
              onCorrectAnswerSubmit={onCorrectAnswerSubmit}
              showResult={showResult}
            />
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/30 p-4 text-sm leading-relaxed">{current.qaQuestion || '题目暂无内容'}</div>
              <Textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="请输入你的答案..."
                className="min-h-[140px]"
                disabled={showResult || grading}
              />
              {showResult && gradeResult && (
                <div className="space-y-2 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3">
                  <div className="text-sm">
                    得分：<span className="font-semibold text-violet-300">{gradeResult.score.toFixed(1)}</span> / 10
                  </div>
                  <div className="text-sm text-foreground/90">评语：{gradeResult.feedback}</div>
                  <div className="text-sm text-foreground/90">建议：{gradeResult.advice}</div>
                  <div className="text-xs text-muted-foreground">参考答案：{current.qaReferenceAnswer || '无'}</div>
                </div>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col items-stretch border-t border-border/40 pt-4 gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSwitchType}
              disabled={rerolling}
              className="w-full gap-2 sm:w-auto"
            >
              <RefreshCw className={cn('h-4 w-4', rerolling && 'animate-spin')} />
              换个题型
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReroll}
              disabled={rerolling}
              className="w-full gap-2 sm:w-auto"
            >
              <Dices className={cn('h-4 w-4', rerolling && 'animate-spin')} />
              换个考法
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCurrentQuestion}
              className="w-full gap-2 sm:w-auto"
            >
              <Copy className="h-4 w-4" />
              复制本题
            </Button>
            {showResult && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="w-full gap-2 text-muted-foreground sm:w-auto"
              >
                <RotateCcw className="h-4 w-4" />
                重做
              </Button>
            )}
          </div>

          {!showResult ? (
            <Button
              onClick={handleSubmit}
              disabled={rerolling || grading || (isOpenEndedType(currentType) && !answerText.trim())}
              className="w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/20 sm:w-auto"
            >
              {grading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              提交答案
            </Button>
          ) : (
            <Button onClick={handleNext} className="w-full gap-2 sm:w-auto">
              {practiceMode === 'random'
                ? '随机下一题'
                : currentIndex >= questions.length - 1
                  ? hasNextChapter
                    ? '下一章'
                    : '完成'
                  : '下一题'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
