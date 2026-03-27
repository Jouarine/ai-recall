'use client';

import useSWR from 'swr';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type AiLog = {
  id: string;
  time: string;
  route: string;
  input: unknown;
  prompt: string;
  output: string;
  error?: string;
};

const fetchLogs = async (url: string): Promise<AiLog[]> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch logs');
  return response.json() as Promise<AiLog[]>;
};

export default function AiLogsPage() {
  const { data: logs = [], mutate } = useSWR<AiLog[]>('/api/ai/logs?limit=100', fetchLogs, {
    refreshInterval: 1500,
  });

  const handleClearLogs = async () => {
    const confirmed = window.confirm('确认清空所有 AI 日志吗？');
    if (!confirmed) return;

    const response = await fetch('/api/ai/logs', { method: 'DELETE' });
    if (!response.ok) {
      alert('清空日志失败');
      return;
    }
    await mutate();
  };

  return (
    <>
      <Navbar />
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-4">
          <h1 className="text-2xl font-bold">AI 调试日志</h1>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">自动刷新：查看输入、提示词、模型输出与错误信息。</p>
            <Button variant="outline" size="sm" onClick={handleClearLogs}>
              一键清空日志
            </Button>
          </div>

          {logs.map((log) => (
            <Card key={log.id} className="border-border/60">
              <CardHeader className="pb-2">
                <div className="text-sm text-muted-foreground">
                  {new Date(log.time).toLocaleString('zh-CN')} / {log.route}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Input</div>
                  <pre className="text-xs rounded bg-muted/40 p-3 overflow-auto">{JSON.stringify(log.input, null, 2)}</pre>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Prompt</div>
                  <pre className="text-xs rounded bg-muted/40 p-3 overflow-auto whitespace-pre-wrap">{log.prompt}</pre>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Output</div>
                  <pre className="text-xs rounded bg-muted/40 p-3 overflow-auto whitespace-pre-wrap">{log.output || '(empty)'}</pre>
                </div>
                {log.error && (
                  <div>
                    <div className="text-xs text-red-400 mb-1">Error</div>
                    <pre className="text-xs rounded bg-red-500/10 p-3 overflow-auto whitespace-pre-wrap">{log.error}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
