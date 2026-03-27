'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowRight, BookX } from 'lucide-react';
import type { ErrorRecord } from '@/types';

interface ErrorBankSummaryProps {
  errors: ErrorRecord[];
}

export function ErrorBankSummary({ errors }: ErrorBankSummaryProps) {
  const unresolvedErrors = errors.filter((e) => !e.resolved);
  const groupedByChapter = unresolvedErrors.reduce(
    (acc, err) => {
      acc[err.chapterName] = (acc[err.chapterName] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookX className="h-4 w-4 text-red-400" />
          <h3 className="text-sm font-semibold">错题统计</h3>
        </div>
        <Badge variant="destructive" className="text-xs">
          {unresolvedErrors.length}
        </Badge>
      </div>

      {unresolvedErrors.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          🎉 暂无错题，继续保持！
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {Object.entries(groupedByChapter).map(([chapter, count]) => (
              <div key={chapter} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground truncate flex-1 mr-2">{chapter}</span>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-amber-400" />
                  <span className="text-amber-400 font-medium tabular-nums">{count}</span>
                </div>
              </div>
            ))}
          </div>

          <Link href="/errors">
            <Button variant="outline" size="sm" className="w-full gap-2 mt-2 text-muted-foreground hover:text-foreground">
              进入错题本
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}
