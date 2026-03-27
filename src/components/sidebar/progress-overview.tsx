'use client';

import { Progress } from '@/components/ui/progress';
import { TrendingUp, Target, Zap } from 'lucide-react';
import type { Chapter } from '@/types';

interface ProgressOverviewProps {
  chapters: Chapter[];
}

export function ProgressOverview({ chapters }: ProgressOverviewProps) {
  const totalMastered = chapters.reduce((sum, ch) => sum + (ch.completedCount ?? 0), 0);
  const totalQuestions = chapters.reduce((sum, ch) => sum + (ch.totalCount ?? 0), 0);
  const progressPercent = totalQuestions > 0 ? Math.round((totalMastered / totalQuestions) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/50 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-medium">学习进度</span>
          </div>
          <span className="text-2xl font-bold tabular-nums text-violet-400">{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-2 bg-muted" />
        <p className="text-xs text-muted-foreground mt-2">
          已掌握 <span className="text-foreground font-medium">{totalMastered}</span> / {totalQuestions} 题
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/50 bg-card/50 p-3 text-center">
          <Target className="h-4 w-4 text-amber-400 mx-auto mb-1" />
          <p className="text-lg font-bold tabular-nums">{chapters.length}</p>
          <p className="text-xs text-muted-foreground">章节</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-card/50 p-3 text-center">
          <Zap className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
          <p className="text-lg font-bold tabular-nums">{totalMastered}</p>
          <p className="text-xs text-muted-foreground">掌握</p>
        </div>
      </div>
    </div>
  );
}
