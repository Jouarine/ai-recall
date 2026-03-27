'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useAiSettings } from '@/store/ai-settings';

interface AiTutorDrawerProps {
  knowledgePointName: string;
  initialContext: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages?: UIMessage[];
}

type MessagePart = UIMessage['parts'][number];

const collectText = (parts: MessagePart[]): string =>
  parts
    .filter((part) => part.type === 'text')
    .map((part) => ('text' in part ? part.text : ''))
    .join('')
    .trim();

const collectReasoning = (parts: MessagePart[]): string =>
  parts
    .filter((part) => part.type === 'reasoning')
    .map((part) => ('text' in part ? part.text : ''))
    .join('')
    .trim();

export function AiTutorDrawer({ knowledgePointName, initialContext, open, onOpenChange }: AiTutorDrawerProps) {
  const { settings, isConfigured } = useAiSettings();
  const [input, setInput] = useState('');

  const { messages, sendMessage, setMessages, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/ai/chat',
      headers: isConfigured()
        ? {
            'x-ai-provider': settings.provider,
            'x-ai-api-key': settings.apiKey,
            'x-ai-model': settings.modelName,
            ...(settings.promptTemplate ? { 'x-ai-prompt-template': settings.promptTemplate } : {}),
            ...(settings.baseUrl ? { 'x-ai-base-url': settings.baseUrl } : {}),
          }
        : {},
    }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const quickPrompts = ['加深解释原理', '举个例子', '扩展相关知识', '用更简单的话说'];

  const submitText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInput('');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[420px] p-0 flex h-full overflow-hidden flex-col bg-background border-border/60">
        <SheetHeader className="p-4 pb-3 border-b border-border/40">
          <SheetTitle className="flex items-center gap-2 text-base">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md shadow-blue-500/20">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            AI 学习导师
          </SheetTitle>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {knowledgePointName || '当前知识点'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => setMessages([])}
            >
              清空记录
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0 p-4">
          <div className="space-y-4">
            {messages.map((msg) => {
              const text = collectText(msg.parts);
              const reasoning = collectReasoning(msg.parts);
              if (!text && !reasoning) return null;

              return (
                <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
                  <div
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                      msg.role === 'assistant'
                        ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20'
                        : 'bg-gradient-to-br from-violet-500/20 to-indigo-500/20'
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <Bot className="h-4 w-4 text-blue-400" />
                    ) : (
                      <User className="h-4 w-4 text-violet-400" />
                    )}
                  </div>
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] space-y-2',
                      msg.role === 'assistant' ? 'bg-muted/50 text-foreground/90' : 'bg-violet-500/15 text-foreground/90'
                    )}
                  >
                    {reasoning && msg.role === 'assistant' && (
                      <div className="rounded-md border border-dashed border-border/60 bg-background/50 p-2">
                        <div className="text-[11px] text-muted-foreground mb-1">推理片段（模型返回）</div>
                        <div className="whitespace-pre-wrap text-xs">{reasoning}</div>
                      </div>
                    )}
                    {text && <div className="whitespace-pre-wrap">{text}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 text-muted-foreground hover:text-foreground border-dashed"
            onClick={() => submitText(`请根据以下上下文开始辅导：\n\n${initialContext || '（无）'}`)}
            disabled={isLoading || !initialContext}
          >
            发送当前上下文
          </Button>
          {quickPrompts.map((prompt) => (
            <Button
              key={prompt}
              variant="outline"
              size="sm"
              className="text-xs h-7 text-muted-foreground hover:text-foreground border-dashed"
              onClick={() => submitText(prompt)}
              disabled={isLoading}
            >
              {prompt}
            </Button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitText(input);
          }}
          className="p-4 pt-2 border-t border-border/40 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              placeholder="问问 AI 导师..."
              className="bg-muted/30"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="shrink-0 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
