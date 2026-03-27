'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Filter,
  PlayCircle,
  SortDesc,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Navbar } from '@/components/navbar';
import type { ErrorRecord } from '@/types';

const fetchErrors = async (url: string): Promise<ErrorRecord[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch errors');
  }
  return response.json() as Promise<ErrorRecord[]>;
};

const formatDate = (value: string | Date): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN');
};

export default function ErrorsPage() {
  const [sortBy, setSortBy] = useState<'count' | 'date'>('count');
  const [filterResolved, setFilterResolved] = useState(false);
  const { data: allErrors = [], isLoading } = useSWR<ErrorRecord[]>('/api/errors', fetchErrors);

  const filtered = useMemo(
    () => (filterResolved ? allErrors : allErrors.filter((e) => !e.resolved)),
    [allErrors, filterResolved]
  );

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'count') return b.errorCount - a.errorCount;
      return new Date(b.lastErrorAt).getTime() - new Date(a.lastErrorAt).getTime();
    });
  }, [filtered, sortBy]);

  return (
    <>
      <Navbar />
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">错题本</h1>
                <p className="text-sm text-muted-foreground">共 {allErrors.filter((e) => !e.resolved).length} 道未解决错题</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setFilterResolved(!filterResolved)}
              >
                <Filter className="h-4 w-4" />
                {filterResolved ? '隐藏已解决' : '显示全部'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setSortBy(sortBy === 'count' ? 'date' : 'count')}
              >
                <SortDesc className="h-4 w-4" />
                {sortBy === 'count' ? '按错误次数' : '按时间'}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {isLoading && (
              <div className="text-sm text-muted-foreground">加载中...</div>
            )}

            {!isLoading && sorted.map((err) => (
              <Card key={err.id} className={cn('border-border/60 transition-all hover:shadow-md', err.resolved && 'opacity-60')}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <Badge
                        variant={err.question.type === 'cloze' ? 'secondary' : 'outline'}
                        className={cn(
                          'text-xs',
                          err.question.type === 'cloze'
                            ? 'bg-violet-500/15 text-violet-400 border-violet-500/20'
                            : 'bg-blue-500/15 text-blue-400 border-blue-500/20'
                        )}
                      >
                        {err.question.type === 'cloze' ? '填空题' : '简答题'}
                      </Badge>
                      <span className="text-sm text-muted-foreground truncate">
                        {err.chapterName} / {err.knowledgePointName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {err.resolved ? (
                        <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          已解决
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                          <span className="text-sm font-semibold text-amber-400 tabular-nums">×{err.errorCount}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="p-3 rounded-lg bg-muted/30 text-sm text-foreground/80 leading-relaxed">
                    {err.question.type === 'cloze'
                      ? err.question.originalText.slice(0, 120) + '...'
                      : err.question.question}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-muted-foreground">最后一次错误：{formatDate(err.lastErrorAt)}</span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                        <PlayCircle className="h-3 w-3" />
                        重做
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
                        <Star className="h-3 w-3" />
                        收藏
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {!isLoading && sorted.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-400/50" />
                <p className="text-lg font-medium">全部搞定</p>
                <p className="text-sm">暂无待解决的错题</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
