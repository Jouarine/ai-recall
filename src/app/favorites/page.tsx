'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { ArrowLeft, PlayCircle, Star, Tag, TriangleAlert, CheckCircle2 } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type FavoriteItem = {
  id: string;
  type: string;
  isStarred: boolean;
  displayText: string | null;
  qaQuestion: string | null;
  updatedAt: string;
  originalText: string;
  knowledgePointName: string;
  chapterName: string;
  materialTitle: string;
  errorCount: number;
};

const fetchFavorites = async (url: string): Promise<FavoriteItem[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch favorites');
  }
  return response.json() as Promise<FavoriteItem[]>;
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN');
};

const typeLabel = (type: string) => {
  const t = type.toLowerCase();
  if (t === 'cloze') return '填空题';
  if (t === 'choice') return '选择题';
  if (t === 'thinking') return '思考题';
  if (t === 'application') return '应用题';
  return '简答题';
};

export default function FavoritesPage() {
  const { data: favorites = [], isLoading, mutate } = useSWR<FavoriteItem[]>('/api/favorites', fetchFavorites);

  const unstar = async (id: string) => {
    await fetch(`/api/questions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isStarred: false }),
    });
    await mutate();
  };

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
                <h1 className="text-2xl font-bold">收藏</h1>
                <p className="text-sm text-muted-foreground">共 {favorites.length} 道收藏题</p>
              </div>
            </div>
          </div>

          {isLoading && <div className="text-sm text-muted-foreground">加载中...</div>}

          {!isLoading && favorites.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-400/50" />
              <p className="text-lg font-medium">暂无收藏题</p>
              <p className="text-sm">做题时点星标即可加入这里</p>
            </div>
          )}

          <div className="space-y-3">
            {favorites.map((item) => (
              <Card key={item.id} className="border-border/60 transition-all hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <Badge variant="secondary" className="text-xs bg-violet-500/15 text-violet-400 border-violet-500/20">
                        {typeLabel(item.type)}
                      </Badge>
                      <span className="text-sm text-muted-foreground truncate">
                        {item.chapterName} / {item.knowledgePointName}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="p-3 rounded-lg bg-muted/30 text-sm text-foreground/80 leading-relaxed">
                    {item.type.toLowerCase() === 'cloze'
                      ? item.originalText.slice(0, 160) + (item.originalText.length > 160 ? '...' : '')
                      : (item.qaQuestion || item.originalText)}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5" />
                        收藏时间：{formatDate(item.updatedAt)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <TriangleAlert className="h-3.5 w-3.5" />
                        累计错题：{item.errorCount}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/?questionId=${item.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 gap-1">
                          <PlayCircle className="h-3.5 w-3.5" />
                          重做
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-amber-400" onClick={() => unstar(item.id)}>
                        <Star className="h-3.5 w-3.5 fill-amber-400" />
                        取消收藏
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
