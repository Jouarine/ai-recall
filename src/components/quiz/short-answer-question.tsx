'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ShortAnswerQuestion, ScoringPoint } from '@/types';

interface ShortAnswerQuestionCardProps {
  question: ShortAnswerQuestion;
  onAnswer: (answer: string) => void;
  showResult: boolean;
}

// Mock scoring result
const mockScoringPoints: ScoringPoint[] = [
  { point: '正确说明了 TCP/IP 模型的四层结构', hit: true },
  { point: '说明了网络接口层的功能', hit: false },
  { point: '说明了网际层(IP层)的功能', hit: true },
  { point: '说明了传输层(TCP/UDP)的功能', hit: true },
  { point: '说明了应用层的功能', hit: false },
];

export function ShortAnswerQuestionCard({ question, onAnswer, showResult }: ShortAnswerQuestionCardProps) {
  const [answer, setAnswer] = useState(question.userAnswer || '');
  const score = showResult ? 60 : undefined;

  return (
    <div className="space-y-5">
      {/* Question Type Badge */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="bg-blue-500/15 text-blue-400 border-blue-500/20">
          简答题
        </Badge>
      </div>

      {/* Question */}
      <div className="text-base leading-relaxed text-foreground/90 p-4 rounded-xl bg-muted/30 border border-border/50">
        {question.question}
      </div>

      {/* Answer Input */}
      <div>
        <Textarea
          placeholder="请输入你的答案..."
          value={answer}
          onChange={(e) => {
            setAnswer(e.target.value);
            onAnswer(e.target.value);
          }}
          disabled={showResult}
          className="min-h-[120px] resize-none bg-card/50"
        />
      </div>

      {/* Scoring Result */}
      {showResult && (
        <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          {/* Score */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-3xl font-bold text-amber-400">{score}</span>
            <span className="text-sm text-amber-300/80">/ 100 分</span>
          </div>

          {/* Scoring Points */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">采分点：</p>
            {mockScoringPoints.map((sp, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {sp.hit ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                )}
                <span className={cn(sp.hit ? 'text-foreground/80' : 'text-muted-foreground')}>{sp.point}</span>
              </div>
            ))}
          </div>

          {/* Reference Answer */}
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-xs font-medium text-emerald-400 mb-1.5">参考答案：</p>
            <p className="text-sm text-emerald-200/80 leading-relaxed">{question.referenceAnswer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
