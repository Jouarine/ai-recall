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
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button variant="outline" size="sm" onClick={onPrevChapter} disabled={!onPrevChapter || disablePrevChapter} className="gap-1">
        <ChevronLeft className="h-4 w-4" />
        上一章
      </Button>
      <Button variant="outline" size="sm" onClick={onPrev} disabled={disablePrev} className="gap-1">
        <ChevronLeft className="h-4 w-4" />
        {'\u4e0a\u4e00\u9898'}
      </Button>
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/50 text-sm tabular-nums">
        <span className="text-foreground font-semibold">{currentIndex + 1}</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">{total}</span>
      </div>
      <Button variant="outline" size="sm" onClick={onNext} disabled={total <= 1} className="gap-1">
        {'\u4e0b\u4e00\u9898'}
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={onNextChapter} disabled={!onNextChapter || disableNextChapter} className="gap-1">
        下一章
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
