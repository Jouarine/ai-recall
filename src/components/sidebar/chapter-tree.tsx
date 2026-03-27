'use client';

import { useState } from 'react';
import { ChevronRight, Circle, CheckCircle2, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Chapter, KnowledgePoint } from '@/types';

interface ChapterTreeProps {
  chapters: Chapter[];
  selectedKnowledgePointId: string | null;
  onSelectKnowledgePoint: (kp: KnowledgePoint) => void;
}

export function ChapterTree({ chapters, selectedKnowledgePointId, onSelectKnowledgePoint }: ChapterTreeProps) {
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set([chapters[0]?.id]));

  const toggleChapter = (id: string) => {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-1">
      {chapters.map((chapter) => {
        const isOpen = openChapters.has(chapter.id);
        const totalCount = chapter.totalCount ?? 0;
        const completedCount = chapter.completedCount ?? 0;
        const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        return (
          <Collapsible key={chapter.id} open={isOpen} onOpenChange={() => toggleChapter(chapter.id)}>
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-foreground transition-colors group">
              <ChevronRight
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                  isOpen && 'rotate-90'
                )}
              />
              <BookOpen className="h-4 w-4 shrink-0 text-violet-400" />
              <span className="truncate flex-1 text-left">{chapter.name}</span>
              <span className="text-xs text-muted-foreground ml-1 tabular-nums">{progress}%</span>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="ml-4 border-l border-border/50 pl-2 space-y-0.5 py-1">
                {(chapter.knowledgePoints || []).map((kp) => {
                  const isSelected = kp.id === selectedKnowledgePointId;
                  const isCompleted = (kp.completedCount ?? 0) >= (kp.totalCount ?? 0) && (kp.totalCount ?? 0) > 0;

                  return (
                    <button
                      key={kp.id}
                      onClick={() => onSelectKnowledgePoint(kp)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-all',
                        isSelected
                          ? 'bg-violet-500/15 text-violet-300 font-medium'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                      )}
                      <span className="truncate text-left">{kp.name}</span>
                    </button>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
