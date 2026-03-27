'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api-client';
import { Sparkles, Loader2, UploadCloud, ClipboardCopy, Import } from 'lucide-react';
import { useSWRConfig } from 'swr';
import { useAiSettings } from '@/store/ai-settings';
import { copyText } from '@/lib/copy';

const TriggerDiv = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { nativeButton?: boolean }>(
  ({ nativeButton, ...props }, ref) => {
    void nativeButton;
    return <div {...props} ref={ref} />;
  }
);
TriggerDiv.displayName = 'TriggerDiv';

type MaterialUploadDialogProps = {
  onCreatedMaterial?: (materialId: string) => void;
};

type ExternalOutline = {
  chapters?: Array<{
    name?: string;
    knowledgePoints?: Array<{
      name?: string;
      originalText?: string;
      question?: {
        type?: string;
        stem?: string;
        sentence?: string;
        answers?: string[];
        options?: string[];
        referenceAnswer?: string;
      };
    }>;
  }>;
};

const QUESTION_TYPE_OPTIONS = [
  { key: 'choice', label: '选择题' },
  { key: 'cloze', label: '填空题' },
  { key: 'short_answer', label: '简答题' },
  { key: 'thinking', label: '思考题' },
  { key: 'application', label: '应用题' },
] as const;

const buildExternalPrompt = (title: string, text: string, questionTypes: string[], extraPrompt: string): string => {
  return `你是教材结构化与出题助手。请将以下资料转为 JSON，严格使用字段，每一条都必须有：
- chapters[].name
- chapters[].knowledgePoints[].name
- chapters[].knowledgePoints[].originalText
- chapters[].knowledgePoints[].question.type
- chapters[].knowledgePoints[].question.stem
- chapters[].knowledgePoints[].question.sentence
- chapters[].knowledgePoints[].question.answers
- chapters[].knowledgePoints[].question.options
- chapters[].knowledgePoints[].question.referenceAnswer
题型范围：${questionTypes.join('、')}
要求：
0. 所有自然语言内容使用“简体中文”。
1. cloze 使用 sentence+answers。
2. choice 提供 stem+options+referenceAnswer。
3. short_answer/thinking/application 提供 stem+referenceAnswer。
4. cloze 的 sentence 必须使用占位符 {{blank_0}}, {{blank_1}}...；禁止使用（）/____/[空] 这类格式。
5. answers 必须与占位符顺序一一对应。
6. 仅输出 JSON，不要解释，不要 Markdown 代码块。
7. 若无法确定内容，也要保留字段，使用空字符串或空数组，不可缺字段。

示例（必须严格仿照字段结构）：
{
  "chapters": [
    {
      "name": "第一章 计算机网络基础",
      "knowledgePoints": [
        {
          "name": "OSI 七层模型",
          "originalText": "OSI 模型将网络通信划分为七层。",
          "question": {
            "type": "cloze",
            "stem": "",
            "sentence": "OSI 模型共有 {{blank_0}} 层。",
            "answers": ["七"],
            "options": [],
            "referenceAnswer": ""
          }
        }
      ]
    }
  ]
}

附加提示词：${extraPrompt || '无'}

资料标题：${title}
资料正文：
${text}`;
};

export function MaterialUploadDialog({ onCreatedMaterial }: MaterialUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState('');
  const [questionTypes, setQuestionTypes] = useState<string[]>(['cloze']);
  const { mutate } = useSWRConfig();
  const { isConfigured } = useAiSettings();

  const toggleType = (type: string) => {
    setQuestionTypes((prev) => {
      if (prev.includes(type)) {
        const next = prev.filter((item) => item !== type);
        return next.length ? next : ['cloze'];
      }
      return [...prev, type];
    });
  };

  const saveMaterial = async (payload: {
    title: string;
    chapters: ExternalOutline['chapters'];
    sourceText?: string;
  }) => {
    const saveRes = await fetch('/api/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const saveData = await saveRes.json().catch(() => null);
    if (!saveRes.ok) {
      throw new Error(saveData?.error || '保存资料结构失败');
    }

    await mutate('/api/materials');
    if (saveData?.id) {
      onCreatedMaterial?.(saveData.id as string);
    }

    setOpen(false);
    setTitle('');
    setText('');
    setExtraPrompt('');
    setQuestionTypes(['cloze']);
  };

  const handleUpload = async () => {
    if (!text.trim() || !title.trim()) return;
    if (!isConfigured()) {
      alert('请先点击右上角设置，配置 AI 引擎密钥。');
      return;
    }

    setLoading(true);
    try {
      const outlineRes = await apiClient.fetch('/api/ai/generate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, text, questionTypes, additionalPrompt: extraPrompt }),
      });
      if (!outlineRes.ok) {
        const err = await outlineRes.json().catch(() => ({ error: 'AI 解析失败' }));
        throw new Error(err.error || 'AI 解析失败');
      }

      const outlineData = (await outlineRes.json()) as ExternalOutline;
      await saveMaterial({ title, chapters: outlineData.chapters, sourceText: text });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '创建资料时发生错误。';
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!title.trim() || !text.trim()) {
      alert('请先填写资料名称和资料正文。');
      return;
    }

    const prompt = buildExternalPrompt(title.trim(), text.trim(), questionTypes, extraPrompt.trim());
    const copied = await copyText(prompt);
    if (copied) {
      alert('已复制提示词。请确保外部 AI 严格使用 {{blank_0}} 占位符，否则导入后无法正确解析。');
      return;
    }
    alert('当前环境不支持自动复制，请长按手动复制。');
  };

  const handleImportOutline = async () => {
    if (!title.trim()) {
      alert('请先填写资料名称。');
      return;
    }

    const raw = window.prompt('请粘贴外部 AI 返回的 JSON 大纲（可包含题目）');
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as ExternalOutline | ExternalOutline['chapters'];
      const chapters = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.chapters) ? parsed.chapters : null;

      if (!chapters || chapters.length === 0) {
        throw new Error('未识别到 chapters 数组');
      }

      await saveMaterial({ title, chapters, sourceText: text.trim() || undefined });
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入失败';
      alert(`导入外部大纲失败：${message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !loading && setOpen(val)}>
      <DialogTrigger
        nativeButton={false}
        render={
          <TriggerDiv className="inline-flex w-full">
            <Button className="w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-500/20">
              <UploadCloud className="h-4 w-4" />
              上传新资料
            </Button>
          </TriggerDiv>
        }
      />
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto scrollbar-hide">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-5">
            <Loader2 className="h-10 w-10 text-violet-500 animate-spin" />
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-lg">AI 正在解析你的资料...</h3>
              <p className="text-sm text-muted-foreground max-w-[340px] leading-relaxed">本次会一次性完成章节拆分和题目生成，请稍等。</p>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-400" />
                解析学习资料
              </DialogTitle>
              <DialogDescription>粘贴资料后可直接解析，也可复制提示词给外部 AI 后导入结果。</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-3">
              <div className="grid gap-2">
                <Label htmlFor="title">资料名称</Label>
                <Input id="title" placeholder="如：操作系统期末复习" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="content">资料正文</Label>
                <Textarea
                  id="content"
                  className="min-h-[220px] resize-y"
                  placeholder="在此粘贴资料全文..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border/50 p-3 space-y-3">
              <p className="text-xs text-muted-foreground">资料题型</p>
              <div className="flex flex-wrap gap-2">
                {QUESTION_TYPE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.key}
                    type="button"
                    size="sm"
                    variant={questionTypes.includes(opt.key) ? 'default' : 'outline'}
                    onClick={() => toggleType(opt.key)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border/50 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">附加提示词</p>
              <Textarea
                id="additionalPrompt"
                className="min-h-[90px] resize-y"
                placeholder="对 AI 的特殊要求（可选）..."
                value={extraPrompt}
                onChange={(e) => setExtraPrompt(e.target.value)}
              />
            </div>

            <div className="rounded-lg border border-border/50 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">外部 AI 工具</p>
              <Button variant="outline" className="w-full gap-2" onClick={handleCopyPrompt}>
                <ClipboardCopy className="h-4 w-4" />
                复制提示词
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={handleImportOutline}>
                <Import className="h-4 w-4" />
                导入外部大纲
              </Button>
            </div>

            <div className="pt-3 flex justify-center">
              <Button
                disabled={!title.trim() || !text.trim()}
                onClick={handleUpload}
                className="w-full max-w-[520px] gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white"
              >
                <Sparkles className="h-4 w-4" />
                一键解析为大纲
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
