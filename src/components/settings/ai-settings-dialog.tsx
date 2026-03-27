'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, KeyRound, Server, Bot, Save } from 'lucide-react';
import { useAiSettings, type AiProvider } from '@/store/ai-settings';
import React from 'react';

const TriggerDiv = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>((props, ref) => (
  <div {...props} ref={ref} />
));
TriggerDiv.displayName = 'TriggerDiv';

export function AiSettingsDialog({ trigger }: { trigger?: React.ReactElement }) {
  const { settings, updateSettings } = useAiSettings();
  const [open, setOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSave = () => {
    updateSettings(localSettings);
    setOpen(false);
  };

  const handleProviderChange = (provider: AiProvider) => {
    let defaults = {
      baseUrl: '',
      modelName: '',
    };

    switch (provider) {
      case 'deepseek':
        defaults = { baseUrl: 'https://api.deepseek.com/v1', modelName: 'deepseek-reasoner' };
        break;
      case 'openai':
        defaults = { baseUrl: 'https://api.openai.com/v1', modelName: 'gpt-4o' };
        break;
      case 'gemini':
        defaults = { baseUrl: '', modelName: 'gemini-2.5-pro' };
        break;
      case 'claude':
        defaults = { baseUrl: '', modelName: 'claude-3-7-sonnet-latest' };
        break;
      default:
        defaults = { baseUrl: '', modelName: '' };
        break;
    }

    setLocalSettings((prev) => ({ ...prev, provider, ...defaults }));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setLocalSettings(settings);
        }
      }}
    >
      {trigger ? (
        <DialogTrigger render={<TriggerDiv className="inline-flex">{trigger}</TriggerDiv>} nativeButton={false} />
      ) : (
        <DialogTrigger
          render={
            <TriggerDiv className="inline-flex">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Settings className="h-4 w-4" />
              </Button>
            </TriggerDiv>
          }
          nativeButton={false}
        />
      )}

      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-violet-400" />
            AI 引擎设置
          </DialogTitle>
          <DialogDescription>
            配置模型与 API，并可自定义每次发送给 AI 的提示词前缀（全局生效）。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          <div className="grid gap-2">
            <Label htmlFor="provider" className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              AI Provider
            </Label>
            <Select value={localSettings.provider} onValueChange={(val) => handleProviderChange(val as AiProvider)}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="选择 AI 提供商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
                <SelectItem value="claude">Anthropic Claude</SelectItem>
                <SelectItem value="custom">自定义 OpenAI 兼容</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="baseUrl" className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              Base URL
            </Label>
            <Input
              id="baseUrl"
              value={localSettings.baseUrl}
              onChange={(e) => setLocalSettings((prev) => ({ ...prev, baseUrl: e.target.value }))}
              placeholder="例如: https://api.deepseek.com/v1"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="apiKey" className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              API Key
            </Label>
            <Input
              id="apiKey"
              type="password"
              value={localSettings.apiKey}
              onChange={(e) => setLocalSettings((prev) => ({ ...prev, apiKey: e.target.value }))}
              placeholder="sk-..."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="modelName" className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              Model
            </Label>
            <Input
              id="modelName"
              value={localSettings.modelName}
              onChange={(e) => setLocalSettings((prev) => ({ ...prev, modelName: e.target.value }))}
              placeholder="例如: deepseek-reasoner / deepseek-chat"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="promptTemplate">全局提示词（可选）</Label>
            <Textarea
              id="promptTemplate"
              value={localSettings.promptTemplate}
              onChange={(e) => setLocalSettings((prev) => ({ ...prev, promptTemplate: e.target.value }))}
              placeholder="例如：你是严谨的考试教练，先指出错误，再给最短可执行建议。"
              className="min-h-[100px]"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="extraPrompt">附加提示词（可选）</Label>
            <Textarea
              id="extraPrompt"
              value={localSettings.extraPrompt}
              onChange={(e) => setLocalSettings((prev) => ({ ...prev, extraPrompt: e.target.value }))}
              placeholder="例如：回答尽量简洁；先打分再给改进步骤。"
              className="min-h-[90px]"
            />
            <p className="text-xs text-muted-foreground">用于做题评分、换题型、换考法时追加给 AI 的特殊要求。</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-border/40">
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            className="w-[120px] gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white"
            onClick={handleSave}
            disabled={!localSettings.apiKey.trim()}
          >
            <Save className="h-4 w-4" />
            保存设置
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
