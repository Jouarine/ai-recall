import { generateText, type LanguageModel } from 'ai';
import { z, type ZodType } from 'zod';
import { appendAiLog } from '@/lib/ai-debug-log';

const PROVIDER_MAX_OUTPUT_TOKENS = 8192;

const stripCodeFence = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  }
  return trimmed;
};

const extractJsonBlock = (text: string): string => {
  const cleaned = stripCodeFence(text);
  const firstObject = cleaned.indexOf('{');
  const firstArray = cleaned.indexOf('[');

  let start = -1;
  if (firstObject === -1) {
    start = firstArray;
  } else if (firstArray === -1) {
    start = firstObject;
  } else {
    start = Math.min(firstObject, firstArray);
  }

  if (start === -1) return cleaned;

  const lastObject = cleaned.lastIndexOf('}');
  const lastArray = cleaned.lastIndexOf(']');
  const end = Math.max(lastObject, lastArray);
  if (end <= start) return cleaned.slice(start);
  return cleaned.slice(start, end + 1);
};

const isLikelyTruncatedJsonError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return /Unterminated string|Unexpected end of JSON input|Unexpected end/i.test(error.message);
};

const isInvalidMaxTokensError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return /Invalid max_tokens value|valid range of max_tokens/i.test(error.message);
};

const repairMalformedJson = async ({
  model,
  malformed,
  maxOutputTokens,
  timeoutMs,
}: {
  model: LanguageModel;
  malformed: string;
  maxOutputTokens: number;
  timeoutMs: number;
}): Promise<string> => {
  const repairPrompt = `你是 JSON 修复助手。请把下面这段损坏的 JSON 修复为“合法 JSON”。
要求：
1. 仅输出 JSON，不要解释。
2. 不要使用 Markdown 代码块。
3. 尽量保持原有字段与内容。
4. 如果尾部严重损坏，删除无法确定的尾部片段，保证 JSON 合法。

损坏 JSON：
${malformed}`;

  const repaired = await generateText({
    model,
    temperature: 0,
    maxOutputTokens,
    timeout: timeoutMs,
    prompt: `${repairPrompt}\n\nPlease output strict JSON only.`,
  });

  return extractJsonBlock(repaired.text);
};

export async function generateJsonWithSchema<T>({
  model,
  schema,
  prompt,
  temperature = 0.3,
  maxRetries = 2,
  maxOutputTokens = 4096,
  timeoutMs = 180000,
  debugRoute = 'unknown',
  debugInput,
}: {
  model: LanguageModel;
  schema: ZodType<T>;
  prompt: string;
  temperature?: number;
  maxRetries?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  debugRoute?: string;
  debugInput?: unknown;
}): Promise<T> {
  let lastError: unknown = null;
  const safeMaxOutputTokens = Math.min(Math.max(maxOutputTokens, 1), PROVIDER_MAX_OUTPUT_TOKENS);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const retryHint =
        attempt === 0
          ? ''
          : `\n\n上一次输出无法被解析为合法 JSON。请本次务必：\n- 闭合所有引号、括号、数组\n- 不输出任何解释文本\n- 仅输出一份完整 JSON\n- 自然语言字段统一使用简体中文。`;

      const response = await generateText({
        model,
        temperature,
        maxOutputTokens: safeMaxOutputTokens,
        timeout: timeoutMs,
        prompt: `${prompt}${retryHint}\n\n请仅输出严格 JSON，不要输出解释、注释或 Markdown 代码块。自然语言字段统一使用简体中文（ID、键名、固定枚举值除外）。`,
      });

      const raw = extractJsonBlock(response.text);

      await appendAiLog({
        route: debugRoute,
        input: debugInput ?? null,
        prompt,
        output: response.text,
      }).catch(() => null);

      try {
        const parsed = JSON.parse(raw) as unknown;
        return schema.parse(parsed);
      } catch (parseError) {
        if (!isLikelyTruncatedJsonError(parseError)) {
          throw parseError;
        }

        const repairedRaw = await repairMalformedJson({
          model,
          malformed: raw,
          maxOutputTokens: safeMaxOutputTokens,
          timeoutMs: Math.min(timeoutMs, 90000),
        });

        const repairedParsed = JSON.parse(repairedRaw) as unknown;
        return schema.parse(repairedParsed);
      }
    } catch (error) {
      await appendAiLog({
        route: debugRoute,
        input: debugInput ?? null,
        prompt,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      }).catch(() => null);
      lastError = error;
      if (isInvalidMaxTokensError(error)) {
        lastError = new Error(`AI 模型的 max_tokens 超出范围，已自动限制到 ${PROVIDER_MAX_OUTPUT_TOKENS}。请重试。`);
      }
    }
  }

  if (isLikelyTruncatedJsonError(lastError)) {
    throw new Error('AI 返回内容在 JSON 阶段被截断，请重试（已自动兜底修复但仍失败）。');
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to generate valid JSON response');
}

export const nonEmptyStringArray = z.array(z.string().trim().min(1)).min(1);
