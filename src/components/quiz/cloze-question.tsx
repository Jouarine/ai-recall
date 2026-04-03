'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

type ClozeBlank = {
  id: string;
  answer: string;
  index: number;
};

type ClozeQuestionView = {
  id: string;
  displayText?: string;
  originalText?: string;
  blanks?: ClozeBlank[];
};

interface ClozeQuestionCardProps {
  question: ClozeQuestionView;
  onWrongAnswerSubmit: (wrongText: string) => void;
  onCorrectAnswerSubmit?: () => void;
  showResult: boolean;
}

export function ClozeQuestionCard({ question, showResult, onWrongAnswerSubmit, onCorrectAnswerSubmit }: ClozeQuestionCardProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showOriginal, setShowOriginal] = useState(false);
  const lastReportedRef = useRef<string>('');

  useEffect(() => {
    if (!showResult) return;

    let isMistake = false;
    const wrongContexts: string[] = [];

    (question.blanks || []).forEach((blank) => {
      const uA = (answers[blank.id] || '').trim();
      if (uA !== blank.answer) {
        isMistake = true;
        if (uA !== '') {
          wrongContexts.push(`填入的错误词汇 "${uA}" (正确词汇应为: "${blank.answer}")`);
        } else {
          wrongContexts.push(`留空未填 (正确词汇应为: "${blank.answer}")`);
        }
      }
    });

    if (isMistake && wrongContexts.length > 0) {
      const userWrongAnswer = wrongContexts.join('; ');
      const reportKey = `${question.id}:${userWrongAnswer}`;
      if (lastReportedRef.current === reportKey) return;
      lastReportedRef.current = reportKey;

      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          userWrongAnswer,
        }),
      }).catch(console.error);

      onWrongAnswerSubmit(userWrongAnswer);
      return;
    }

    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: question.id,
        resolved: true,
      }),
    })
      .then(() => onCorrectAnswerSubmit?.())
      .catch(console.error);
  }, [showResult, answers, question.blanks, question.id, onWrongAnswerSubmit, onCorrectAnswerSubmit]);

  useEffect(() => {
    if (!showResult) {
      lastReportedRef.current = '';
    }
  }, [showResult, question.id]);

  const handleChange = (blankId: string, value: string) => {
    const newAnswers = { ...answers, [blankId]: value };
    setAnswers(newAnswers);
  };

  const renderDisplayText = () => {
    if (!question.displayText) return <span>题目渲染失败</span>;
    const parts = question.displayText.split(/(\{\{blank_\d+\}\})/g);

    return parts.map((part: string, i: number) => {
      const match = part.match(/\{\{blank_(\d+)\}\}/);
      if (!match) {
        return <span key={i}>{part}</span>;
      }

      const blankIndex = parseInt(match[1], 10);
      const blank = (question.blanks || []).find((b) => b.index === blankIndex);
      if (!blank) return null;

      const userAnswer = answers[blank.id] || '';
      const isCorrect = showResult && userAnswer.trim() === blank.answer;
      const isWrong = showResult && userAnswer.trim() !== '' && userAnswer.trim() !== blank.answer;
      const isEmptyWrong = showResult && userAnswer.trim() === '';

      return (
        <span key={i} className="inline-flex items-center mx-1 align-baseline relative">
          <span className="relative inline-flex flex-col items-center">
            <Input
              className={cn(
                'inline-block min-w-28 w-auto px-2 h-8 text-center text-base md:text-sm font-medium border-b-2 border-t-0 border-x-0 rounded-none bg-transparent',
                !showResult && 'border-violet-400/50 focus:border-violet-400',
                isCorrect && 'border-emerald-400 text-emerald-400',
                (isWrong || isEmptyWrong) && 'border-red-400 text-red-400'
              )}
              value={userAnswer}
              onChange={(e) => handleChange(blank.id, e.target.value)}
              disabled={showResult}
              placeholder={`填空 ${blankIndex + 1}`}
              style={{ width: `calc(3rem + ${Math.max(userAnswer.length, 4)}ch)` }}
            />
            {showResult && (isWrong || isEmptyWrong) && (
              <span className="absolute -bottom-5 text-xs text-emerald-400 whitespace-nowrap hidden sm:block">
                {blank.answer}
              </span>
            )}
          </span>
        </span>
      );
    });
  };

  return (
    <div className="space-y-5">
      <div className="text-base leading-10 text-foreground/90 p-5 rounded-xl bg-muted/30 border border-border/50 break-words mb-4">
        {renderDisplayText()}
      </div>

      <div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => setShowOriginal(!showOriginal)}
        >
          {showOriginal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showOriginal ? '隐藏原文' : '查看原句'}
        </Button>
        {showOriginal && (
          <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-200/80 leading-relaxed">
            {question.originalText}
          </div>
        )}
      </div>
    </div>
  );
}
