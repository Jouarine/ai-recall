'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ChapterTree } from './chapter-tree';
import { ProgressOverview } from './progress-overview';
import type { Chapter, KnowledgePoint } from '@/types';

interface SidebarProps {
  chapters: Chapter[];
  materialTitle: string;
  selectedKnowledgePointId: string | null;
  onSelectKnowledgePoint: (kp: KnowledgePoint) => void;
}

export function Sidebar({ chapters, materialTitle, selectedKnowledgePointId, onSelectKnowledgePoint }: SidebarProps) {
  void materialTitle;

  return (
    <>
      <Separator />

      <div className="p-4 pb-2">
        <ProgressOverview chapters={chapters} />
      </div>

      <Separator />

      <ScrollArea className="flex-1 p-2">
        <div className="p-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">章节目录</h3>
          <ChapterTree
            chapters={chapters}
            selectedKnowledgePointId={selectedKnowledgePointId}
            onSelectKnowledgePoint={onSelectKnowledgePoint}
          />
        </div>
      </ScrollArea>
    </>
  );
}
