'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface QuizToolbarProps {
  currentIndex: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onPrevChapter?: () => void;
  onNextChapter?: () => void;
  disablePrev?: boolean;
  disablePrevChapter?: boolean;
  disableNextChapter?: boolean;
}

export function QuizToolbar({
  currentIndex,
  total,
  onPrev,
  onNext,
  onPrevChapter,
  onNextChapter,
  disablePrev = false,
  disablePrevChapter = false,
  disableNextChapter = false,
}: QuizToolbarProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:overflow-visible">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrevChapter}
        disabled={!onPrevChapter || disablePrevChapter}
        className="gap-1 shrink-0"
      >
        <ChevronLeft className="h-4 w-4" />
        上一章
      </Button>
      <Button variant="outline" size="sm" onClick={onPrev} disabled={disablePrev} className="gap-1 shrink-0">
        <ChevronLeft className="h-4 w-4" />
        上一题
      </Button>
      <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1 text-sm tabular-nums shrink-0">
        <span className="font-semibold text-foreground">{currentIndex + 1}</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">{total}</span>
      </div>
      <Button variant="outline" size="sm" onClick={onNext} disabled={total <= 1} className="gap-1 shrink-0">
        下一题
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onNextChapter}
        disabled={!onNextChapter || disableNextChapter}
        className="gap-1 shrink-0"
      >
        下一章
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
