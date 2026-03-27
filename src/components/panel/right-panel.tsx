'use client';

import { ErrorBankSummary } from './error-bank-summary';
import { Button } from '@/components/ui/button';
import { MessageCircleQuestion, Sparkles } from 'lucide-react';
import type { ErrorRecord } from '@/types';
import { cn } from '@/lib/utils';

interface RightPanelProps {
  errors: ErrorRecord[];
  onOpenAiTutor: () => void;
  collapsed?: boolean;
}

export function RightPanel({
  errors,
  onOpenAiTutor,
  collapsed = false,
}: RightPanelProps) {
  return (
    <aside className={cn('flex h-full w-full flex-col p-4 gap-4', collapsed && 'items-center p-2 gap-2')}>
      {collapsed ? (
        <Button
          onClick={onOpenAiTutor}
          size="icon"
          className="h-10 w-10 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20"
          title="\u6253\u5f00 AI \u5bfc\u5e08"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      ) : (
        <>
          <Button
            onClick={onOpenAiTutor}
            className="w-full gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20"
          >
            <Sparkles className="h-4 w-4" />
            {'\u95ee\u95ee AI \u5bfc\u5e08'}
          </Button>

          <ErrorBankSummary errors={errors} />

          <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <MessageCircleQuestion className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-semibold">{'\u5b66\u4e60\u5c0f\u8d34\u58eb'}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {'\u9047\u5230\u4e0d\u4f1a\u7684\u9898\u76ee\uff0c\u53ef\u4ee5\u70b9\u51fb '}
              <span className="text-blue-400">{'\u201c\u95ee\u95ee AI\u201d'}</span>
              {'\uff0cAI \u5bfc\u5e08\u4f1a\u7ed3\u5408\u5f53\u524d\u77e5\u8bc6\u70b9\u7ed9\u4f60\u4e2a\u6027\u5316\u8bb2\u89e3\u3002'}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {'\u4f7f\u7528 '}
              <span className="text-violet-400">{'\u201c\u6362\u4e2a\u8003\u6cd5\u201d'}</span>
              {' \u53ef\u4ee5\u8ba9 AI \u5728\u540c\u4e00\u6bb5\u843d\u91cc\u6316\u6398\u4e0d\u540c\u8003\u70b9\uff0c\u5e2e\u52a9\u4f60\u66f4\u7a33\u5730\u638c\u63e1\u77e5\u8bc6\u3002'}
            </p>
          </div>
        </>
      )}
    </aside>
  );
}
